/**
 * Pull-based executor for Phase 1 Local-First Migration
 * 
 * Desktop pulls next step from cloud instead of waiting for SSE push.
 * This enables desktop to survive SSE disconnections and control execution timing.
 * 
 * Feature flag: ENABLE_DESKTOP_PULL (default: enabled)
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class PullExecutor {
    constructor(apiClient, config = {}) {
        this.apiClient = apiClient;
        this.maxRetries = config.maxRetries || 3;
        this.timeoutMs = config.timeoutMs || 90000; // 90 seconds
        this.pollIntervalMs = config.pollIntervalMs || 1000;
        this.isRunning = false;
        this.currentRunId = null;
        this.stepResults = []; // Track completed steps for context
        this.systemContext = this.getSystemContext(); // Cache system context
    }
    
    /**
     * Get system context for arg generation
     */
    getSystemContext() {
        const os = require('os');
        const path = require('path');
        
        return {
            os: os.platform(),
            user: os.userInfo().username,
            home_dir: os.homedir(),
            desktop_path: path.join(os.homedir(), 'Desktop'),
            shell: process.env.SHELL || 'bash'
        };
    }

    /**
     * Execute a run using pull-based approach
     */
    async executeRun(runId) {
        if (this.isRunning) {
            throw new Error('Executor already running');
        }

        this.isRunning = true;
        this.currentRunId = runId;
        let lastCompletedStep = -1;

        console.log(`[PullExecutor] Starting run ${runId}`);

        try {
            while (this.isRunning) {
                // Pull next step from cloud
                const nextStep = await this.fetchNextStep(runId, lastCompletedStep);

                if (nextStep.status === 'complete') {
                    console.log(`[PullExecutor] Run complete: ${nextStep.final_status}`);
                    break;
                }

                if (nextStep.status === 'cancelled') {
                    console.log(`[PullExecutor] Run cancelled`);
                    break;
                }

                if (nextStep.status === 'not_found') {
                    console.error(`[PullExecutor] Run not found: ${runId}`);
                    break;
                }

                if (nextStep.status === 'out_of_sync') {
                    console.warn(`[PullExecutor] Out of sync, resyncing...`);
                    console.warn(`  Expected last completed: ${nextStep.expected_last_completed}`);
                    console.warn(`  Received last completed: ${nextStep.received_last_completed}`);
                    lastCompletedStep = nextStep.expected_last_completed;
                    continue;
                }

                if (nextStep.status !== 'ready') {
                    console.error(`[PullExecutor] Unexpected status: ${nextStep.status}`);
                    await this.sleep(this.pollIntervalMs);
                    continue;
                }

                // Execute step locally
                console.log(`[PullExecutor] Executing step ${nextStep.step_index + 1}/${nextStep.total_steps}`);
                const result = await this.executeStepWithRetry(nextStep);

                // Report result to cloud
                const reported = await this.reportStepResult(runId, nextStep.step_index, result);

                // Phase 3: Handle adaptive recovery
                if (reported.status === 'needs_recovery') {
                    console.warn(`[PullExecutor] Step failed, attempting adaptive recovery...`);
                    
                    // Fetch recovery step from backend
                    const recoveryStep = await this.fetchNextStep(runId, lastCompletedStep);
                    
                    if (recoveryStep.status === 'ready' && recoveryStep.adaptive_recovery) {
                        console.log(`[PullExecutor] Executing recovery step: ${recoveryStep.step.tool_name}`);
                        console.log(`[PullExecutor] Recovery description: ${recoveryStep.step.description}`);
                        
                        // Execute recovery step
                        const recoveryResult = await this.executeStepWithRetry(recoveryStep);
                        
                        // Report recovery result
                        const recoveryReported = await this.reportStepResult(runId, nextStep.step_index, recoveryResult);
                        
                        if (recoveryReported.status === 'accepted') {
                            console.log(`[PullExecutor] ✓ Recovery successful, continuing execution`);
                            lastCompletedStep = nextStep.step_index;
                        } else if (recoveryReported.status === 'failed') {
                            console.error(`[PullExecutor] ✗ Recovery failed, run terminated`);
                            break;
                        }
                    } else {
                        console.error(`[PullExecutor] No recovery step available, run terminated`);
                        break;
                    }
                } else if (reported.status === 'failed') {
                    console.error(`[PullExecutor] Step failed, run terminated`);
                    break;
                } else {
                    // Step succeeded normally
                    lastCompletedStep = nextStep.step_index;
                }
            }
        } catch (error) {
            console.error(`[PullExecutor] Fatal error:`, error);
            throw error;
        } finally {
            this.isRunning = false;
            this.currentRunId = null;
        }
    }

    /**
     * Fetch next step from cloud
     */
    async fetchNextStep(runId, lastCompletedStep) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/next-step`;
        const params = lastCompletedStep >= 0 ? `?last_completed_step=${lastCompletedStep}` : '';

        try {
            const response = await fetch(url + params, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiClient.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 501) {
                    throw new Error('Desktop pull API disabled on server');
                }
                throw new Error(`Failed to fetch next step: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[PullExecutor] Error fetching next step:`, error);
            throw error;
        }
    }

    /**
     * Generate args for a step using backend API (Adaptive Execution - Ping-Pong Pattern)
     */
    async generateStepArgs(runId, step, previousError = null) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/steps/${step.step_id}/generate-args`;
        
        console.log(`[PullExecutor] 🤔 Generating args for step ${step.step_id}`);
        
        // Build request body with full context
        const requestBody = {
            step: {
                step_id: step.step_id,
                tool_name: step.tool_name || step.tool,
                intent: step.intent,
                description: step.description,
                goal: step.goal
            },
            context: this.systemContext,
            previous_steps: this.stepResults.map(r => ({
                step_id: r.step_id,
                description: r.description,
                result: {
                    success: r.success,
                    output: r.stdout || r.output,
                    filename: r.filename
                }
            })),
            error: previousError
        };
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiClient.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                console.error(`[PullExecutor] Arg generation failed: ${response.status}`);
                return null;
            }
            
            const result = await response.json();
            
            if (result.status === 'error') {
                console.error(`[PullExecutor] Arg generation error: ${result.error}`);
                return null;
            }
            
            console.log(`[PullExecutor] ✓ Args generated successfully`);
            return result.args;
            
        } catch (error) {
            console.error(`[PullExecutor] Failed to generate args:`, error);
            return null;
        }
    }

    /**
     * Execute step with retry logic
     */
    async executeStepWithRetry(stepConfig) {
        const step = stepConfig.step;
        const maxRetries = stepConfig.max_retries || this.maxRetries;
        const timeoutSec = stepConfig.timeout_sec || (this.timeoutMs / 1000);
        
        // Track step results for placeholder resolution
        if (!this.stepResults) {
            this.stepResults = [];
        }

        let lastError = null;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PullExecutor] Attempt ${attempt}/${maxRetries}`);
                
                // ADAPTIVE EXECUTION: Generate args if not present or if retrying after error
                if (!step.args || (attempt > 1 && lastError)) {
                    console.log(`[PullExecutor] ${!step.args ? 'No args in plan' : 'Retrying with adaptive args'}`);
                    
                    const generatedArgs = await this.generateStepArgs(
                        this.currentRunId,
                        step,
                        lastError ? {
                            args: step.args,
                            message: lastError,
                            attempt: attempt - 1
                        } : null
                    );
                    
                    if (generatedArgs) {
                        // Update step with generated args
                        step.args = generatedArgs;
                        console.log(`[PullExecutor] ✓ Using ${attempt > 1 ? 'adaptive' : 'generated'} args`);
                    } else if (!step.args) {
                        // Arg generation failed and no fallback args
                        console.error(`[PullExecutor] ✗ Arg generation failed, no fallback available`);
                        return {
                            success: false,
                            error: 'Failed to generate args and no fallback available',
                            attempts: attempt,
                            execution_time_ms: Date.now() - startTime
                        };
                    } else {
                        // Generation failed but step has args from previous attempt, use them
                        console.warn(`[PullExecutor] ⚠️  Arg generation failed, using previous args as fallback`);
                    }
                }
                
                // Resolve placeholders in fs.write content before execution
                let resolvedStep = step;
                if ((step.tool_name === 'fs.write' || step.tool === 'fs.write') && step.args && step.args.content) {
                    const resolvedContent = this.resolvePlaceholders(step.args.content, this.stepResults);
                    if (resolvedContent !== step.args.content) {
                        resolvedStep = {
                            ...step,
                            args: {
                                ...step.args,
                                content: resolvedContent
                            }
                        };
                    }
                }
                
                const result = await this.executeStep(resolvedStep, timeoutSec);

                if (result.success) {
                    const executionTime = Date.now() - startTime;
                    const finalResult = {
                        success: true,
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exit_code: result.exit_code,
                        attempts: attempt,
                        execution_time_ms: executionTime,
                        // Store step context for future arg generation
                        step_id: step.step_id,
                        description: step.description,
                        filename: result.filename || (step.args && step.args.filename)
                    };
                    
                    // Store result for future context
                    this.stepResults.push(finalResult);
                    
                    return finalResult;
                }

                lastError = result.error || `Exit code ${result.exit_code}`;

                // Exponential backoff before retry
                if (attempt < maxRetries) {
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    console.warn(`[PullExecutor] Step failed, retrying in ${backoffMs}ms...`);
                    await this.sleep(backoffMs);
                }

            } catch (error) {
                lastError = error.message;
                console.error(`[PullExecutor] Attempt ${attempt} error:`, error);

                if (attempt < maxRetries) {
                    const backoffMs = 1000 * Math.pow(2, attempt - 1);
                    await this.sleep(backoffMs);
                }
            }
        }

        const executionTime = Date.now() - startTime;
        return {
            success: false,
            error: lastError,
            attempts: maxRetries,
            execution_time_ms: executionTime
        };
    }

    /**
     * Translate server paths to local desktop paths
     */
    translatePath(filePath) {
        if (!filePath || typeof filePath !== 'string') return filePath;
        
        const os = require('os');
        const path = require('path');
        
        // If path contains /home/appuser/Desktop, map to local Desktop
        if (filePath.includes('/home/appuser/Desktop')) {
            const basename = path.basename(filePath);
            const localDesktop = path.join(os.homedir(), 'Desktop');
            const translated = path.join(localDesktop, basename);
            console.log(`[PullExecutor] Path translation: ${filePath} -> ${translated}`);
            return translated;
        }
        
        return filePath;
    }

    /**
     * Resolve placeholders in content using previous step results
     */
    resolvePlaceholders(content, stepResults) {
        if (!content || typeof content !== 'string') return content;
        if (!stepResults || stepResults.length === 0) return content;
        
        // Pattern: <SOMETHING_PLACEHOLDER>
        const placeholderPattern = /<([A-Z_]+)_PLACEHOLDER>/g;
        
        let resolved = content;
        const matches = content.match(placeholderPattern);
        
        if (matches && matches.length > 0) {
            console.log(`[PullExecutor] Found ${matches.length} placeholder(s) to resolve`);
            
            // Use the most recent step result that has stdout
            const lastResult = stepResults.slice().reverse().find(r => r && r.stdout);
            
            if (lastResult && lastResult.stdout) {
                // Replace all placeholders with the last step's output
                resolved = content.replace(placeholderPattern, lastResult.stdout.trim());
                console.log(`[PullExecutor] Resolved placeholders using previous step output`);
            } else {
                console.warn(`[PullExecutor] No previous step output available to resolve placeholders`);
            }
        }
        
        return resolved;
    }

    /**
     * Execute a single step
     */
    async executeStep(step, timeoutSec) {
        const tool = step.tool_name || step.tool;
        let args = step.args || {};

        console.log(`[PullExecutor] Executing: ${tool}`);
        
        // Apply path translation for file operations
        if (tool === 'fs.write' || tool === 'fs.read') {
            if (args.filename) {
                args = { ...args, filename: this.translatePath(args.filename) };
            }
            if (args.path) {
                args = { ...args, path: this.translatePath(args.path) };
            }
            if (args.file_path) {
                args = { ...args, file_path: this.translatePath(args.file_path) };
            }
        }

        // Handle different tool types
        if (tool === 'shell.command' || tool === 'command' || tool === 'shell_exec') {
            return await this.executeShellCommand(args, timeoutSec, step);
        } else if (tool === 'fs.write') {
            return await this.executeFileWrite(args, step);
        } else if (tool === 'fs.read') {
            return await this.executeFileRead(args);
        } else if (tool === 'browser') {
            return await this.executeBrowserSearch(args);
        } else if (tool === 'think') {
            return await this.executeThink(args);
        } else if (tool === 'user_input') {
            return await this.executeUserInput(args);
        } else if (tool === 'start_background_process') {
            return await this.executeStartBackgroundProcess(args);
        } else if (tool === 'monitor_process') {
            return await this.executeMonitorProcess(args);
        } else if (tool === 'stop_process') {
            return await this.executeStopProcess(args);
        } else {
            return {
                success: false,
                error: `Unsupported tool: ${tool}`,
                exit_code: -1
            };
        }
    }

    /**
     * Execute shell command
     */
    async executeShellCommand(commandOrArgs, timeoutSec, step) {
        const os = require('os');
        const path = require('path');
        
        try {
            // Handle both string command and args object
            let command, cwd, env;
            if (typeof commandOrArgs === 'string') {
                command = commandOrArgs;
            } else if (typeof commandOrArgs === 'object') {
                command = commandOrArgs.command || commandOrArgs.cmd;
                cwd = commandOrArgs.cwd;
                env = commandOrArgs.env;
            }
            
            // If no command but step description mentions Desktop path, provide it directly
            if (!command && step) {
                const description = (step.description || step.goal || '').toLowerCase();
                if (description.includes('desktop') && (description.includes('path') || description.includes('directory'))) {
                    const desktopPath = path.join(os.homedir(), 'Desktop');
                    console.log(`[PullExecutor] Auto-providing Desktop path: ${desktopPath}`);
                    return {
                        success: true,
                        stdout: desktopPath,
                        stderr: '',
                        exit_code: 0
                    };
                }
            }
            
            if (!command) {
                throw new Error('No command specified');
            }
            
            const execOptions = {
                timeout: timeoutSec * 1000,
            };
            
            if (cwd) {
                execOptions.cwd = cwd;
                console.log(`[PullExecutor] Executing in directory: ${cwd}`);
            }
            
            if (env) {
                execOptions.env = { ...process.env, ...env };
                console.log(`[PullExecutor] With environment variables: ${Object.keys(env).join(', ')}`);
            }
            
            const { stdout, stderr } = await execAsync(command, execOptions);

            return {
                success: true,
                stdout: stdout,
                stderr: stderr,
                exit_code: 0
            };
        } catch (error) {
            return {
                success: false,
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exit_code: error.code || 1,
                error: error.message
            };
        }
    }

    /**
     * Execute file read
     */
    async executeFileRead(args) {
        const fs = require('fs').promises;
        
        try {
            const filePath = args.filename || args.path || args.file_path;
            const encoding = args.encoding || 'utf8';
            const maxLines = args.max_lines || args.maxLines;
            
            if (!filePath) {
                throw new Error('No file path specified in args. AI must provide full absolute path');
            }
            
            console.log(`[PullExecutor] Reading file: ${filePath}`);
            
            // Read file
            const content = await fs.readFile(filePath, encoding);
            
            // Limit lines if requested
            let finalContent = content;
            if (maxLines && typeof maxLines === 'number') {
                const lines = content.split('\n');
                finalContent = lines.slice(0, maxLines).join('\n');
                console.log(`[PullExecutor] Limited to ${maxLines} lines (total: ${lines.length})`);
            }
            
            console.log(`[PullExecutor] Read ${finalContent.length} characters`);
            
            return {
                success: true,
                stdout: finalContent,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error('[PullExecutor] fs.read failed', {
                message: error.message,
                args
            });
            return {
                success: false,
                error: error.message,
                stdout: '',
                stderr: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Execute file write (supports single file or multi-file projects)
     */
    async executeFileWrite(args, step) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');

        try {
            // Check if this is a multi-file project (has "files" array)
            if (args.files && Array.isArray(args.files)) {
                console.log(`[PullExecutor] 📁 Multi-file project: ${args.files.length} files`);
                
                const results = [];
                for (const file of args.files) {
                    const filePath = this.translatePath(file.filename || file.path);
                    const content = file.content || '';
                    
                    if (!filePath) {
                        console.warn(`[PullExecutor] Skipping file with no path`);
                        continue;
                    }
                    
                    console.log(`[PullExecutor] Writing: ${filePath}`);
                    console.log(`[PullExecutor] Content preview: ${content.substring(0, 80)}...`);
                    
                    // Ensure directory exists
                    const dir = path.dirname(filePath);
                    await fs.mkdir(dir, { recursive: true });
                    
                    // Write file
                    await fs.writeFile(filePath, content, 'utf8');
                    results.push(filePath);
                }
                
                return {
                    success: true,
                    stdout: `Created ${results.length} files:\n${results.join('\n')}`,
                    stderr: '',
                    exit_code: 0,
                    files_created: results
                };
            }
            
            // Single file write (original behavior)
            const filePath = args.filename || args.path || args.file_path;
            const content = args.content || args.text || args.data || '';
            const shouldAppend = args.append === "true" || args.append === true;
            const encoding = args.encoding || 'utf8';

            // Validate required args
            if (!filePath) {
                throw new Error('No file path specified in args. AI must provide full absolute path (e.g., /Users/user/Desktop/file.txt)');
            }

            if (content === undefined || content === null) {
                throw new Error('No content specified in args. AI must provide content to write');
            }

            console.log(`[PullExecutor] Writing file: ${filePath}`);
            console.log(`[PullExecutor] Content: ${content.substring(0, 100)}...`);
            console.log(`[PullExecutor] Mode: ${shouldAppend ? 'append' : 'overwrite'}, Encoding: ${encoding}`);

            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });

            // Write or append file
            if (shouldAppend) {
                await fs.appendFile(filePath, content, encoding);
            } else {
                await fs.writeFile(filePath, content, encoding);
            }

            return {
                success: true,
                stdout: `File written: ${filePath}\nContent: ${content}`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            console.error('[PullExecutor] fs.write failed', {
                message: error.message,
                args,
                stepDescription: step && step.description
            });
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute file read
     */
    async executeFileRead(args) {
        const fs = require('fs').promises;

        try {
            const filePath = args.path || args.file_path;
            const content = await fs.readFile(filePath, 'utf8');

            return {
                success: true,
                stdout: content,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute browser search (web scraping)
     */
    async executeBrowserSearch(args) {
        try {
            const query = args.query || args.search || args.q;
            
            if (!query) {
                throw new Error('No search query provided');
            }

            // Use DuckDuckGo Instant Answer API (no API key required)
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            
            const response = await fetch(url);
            const data = await response.json();

            // Format the results
            let result = `Search results for: ${query}\n\n`;
            
            if (data.AbstractText) {
                result += `Summary: ${data.AbstractText}\n`;
                if (data.AbstractURL) {
                    result += `Source: ${data.AbstractURL}\n`;
                }
            }
            
            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                result += `\nRelated Topics:\n`;
                data.RelatedTopics.slice(0, 5).forEach((topic, i) => {
                    if (topic.Text) {
                        result += `${i + 1}. ${topic.Text}\n`;
                        if (topic.FirstURL) {
                            result += `   ${topic.FirstURL}\n`;
                        }
                    }
                });
            }

            return {
                success: true,
                stdout: result || `No results found for: ${query}`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute think tool (internal reasoning, no external action)
     */
    async executeThink(args) {
        try {
            const thought = args.thought || args.content || args.message || '';
            
            // Think tool just logs reasoning and succeeds
            console.log(`[PullExecutor] Think: ${thought}`);
            
            return {
                success: true,
                stdout: `Thought: ${thought}`,
                stderr: '',
                exit_code: 0
            };
        } catch (error) {
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Execute user_input tool (prompt user and wait for response)
     */
    async executeUserInput(args) {
        try {
            const prompt = args.prompt || args.question || args.message || 'Please provide input:';
            const defaultValue = args.default || '';
            
            console.log(`[PullExecutor] Requesting user input: ${prompt}`);
            
            // Create a promise that will be resolved when user responds
            const userResponse = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('User input timeout (60s)'));
                }, 60000); // 60 second timeout
                
                // Send request to renderer via IPC
                const { ipcMain } = require('electron');
                const requestId = `user_input_${Date.now()}`;
                
                // Listen for response
                const responseHandler = (event, data) => {
                    if (data.requestId === requestId) {
                        clearTimeout(timeoutId);
                        ipcMain.removeListener('user-input-response', responseHandler);
                        resolve(data.response);
                    }
                };
                
                ipcMain.on('user-input-response', responseHandler);
                
                // Send request to all windows
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(win => {
                    win.webContents.send('user-input-request', {
                        requestId,
                        prompt,
                        defaultValue
                    });
                });
            });
            
            console.log(`[PullExecutor] User responded: ${userResponse}`);
            
            return {
                success: true,
                stdout: userResponse,
                stderr: '',
                exit_code: 0,
                user_response: userResponse
            };
        } catch (error) {
            console.error(`[PullExecutor] User input error:`, error);
            return {
                success: false,
                stdout: '',
                stderr: error.message,
                exit_code: 1,
                error: error.message
            };
        }
    }

    /**
     * Start a background process (Phase 4)
     */
    async executeStartBackgroundProcess(args) {
        let { command, cwd, name, wait_for_ready } = args;
        const { spawn } = require('child_process');
        const crypto = require('crypto');
        
        // Handle command as array or string (backend may send either format)
        if (Array.isArray(command)) {
            command = command.join(' ');
        }
        
        // Validate command
        if (!command || typeof command !== 'string') {
            throw new Error(`Invalid command: ${JSON.stringify(command)}. Expected string or array.`);
        }
        
        console.log(`[PullExecutor] Starting background process: ${command}`);
        
        try {
            // Generate unique process ID
            const processId = `proc-${crypto.randomBytes(6).toString('hex')}`;
            
            // Spawn process
            const proc = spawn(command, [], {
                cwd: cwd || process.cwd(),
                shell: true,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // Store process reference
            if (!this.backgroundProcesses) {
                this.backgroundProcesses = new Map();
            }
            this.backgroundProcesses.set(processId, {
                process: proc,
                command,
                name: name || command,
                logs: [],
                startTime: Date.now()
            });
            
            // Capture logs
            let readyDetected = false;
            const logBuffer = [];
            
            proc.stdout.on('data', (data) => {
                const line = data.toString();
                logBuffer.push(line);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.logs.push(line);
                }
                console.log(`[Process ${processId}] ${line}`);
                
                // Check for ready signal
                if (wait_for_ready && !readyDetected && line.includes(wait_for_ready)) {
                    readyDetected = true;
                    console.log(`[PullExecutor] Process ready detected: ${wait_for_ready}`);
                }
            });
            
            proc.stderr.on('data', (data) => {
                const line = data.toString();
                logBuffer.push(line);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.logs.push(line);
                }
                console.error(`[Process ${processId}] ${line}`);
                
                // Check for ready signal in stderr too
                if (wait_for_ready && !readyDetected && line.includes(wait_for_ready)) {
                    readyDetected = true;
                    console.log(`[PullExecutor] Process ready detected (stderr): ${wait_for_ready}`);
                }
            });
            
            proc.on('exit', (code) => {
                console.log(`[PullExecutor] Process ${processId} exited with code ${code}`);
                const procData = this.backgroundProcesses.get(processId);
                if (procData) {
                    procData.exitCode = code;
                    procData.exitTime = Date.now();
                }
            });
            
            // Wait for ready signal if specified
            if (wait_for_ready) {
                const timeout = 30000; // 30 seconds
                const startWait = Date.now();
                
                while (!readyDetected && Date.now() - startWait < timeout) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Check if process died
                    if (proc.exitCode !== null) {
                        return {
                            success: false,
                            error: `Process exited with code ${proc.exitCode} before ready signal`,
                            stdout: logBuffer.join(''),
                            exit_code: proc.exitCode
                        };
                    }
                }
                
                if (!readyDetected) {
                    return {
                        success: false,
                        error: `Timeout waiting for ready signal: "${wait_for_ready}"`,
                        stdout: logBuffer.join(''),
                        exit_code: -1
                    };
                }
            } else {
                // Give process a moment to start
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return {
                success: true,
                stdout: `Process started with ID: ${processId}\nPID: ${proc.pid}\n${logBuffer.join('')}`,
                process_id: processId,
                pid: proc.pid,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error starting background process:`, error);
            return {
                success: false,
                error: error.message,
                stdout: '',
                stderr: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Monitor a background process (Phase 4)
     */
    async executeMonitorProcess(args) {
        const { process_id, log_lines = 50 } = args;
        
        console.log(`[PullExecutor] Monitoring process: ${process_id}`);
        
        try {
            if (!this.backgroundProcesses || !this.backgroundProcesses.has(process_id)) {
                return {
                    success: false,
                    error: `Process not found: ${process_id}`,
                    exit_code: 1
                };
            }
            
            const procData = this.backgroundProcesses.get(process_id);
            const isRunning = procData.process.exitCode === null;
            const uptime = isRunning ? Date.now() - procData.startTime : procData.exitTime - procData.startTime;
            
            const recentLogs = procData.logs.slice(-log_lines).join('');
            
            const status = {
                process_id,
                name: procData.name,
                command: procData.command,
                pid: procData.process.pid,
                status: isRunning ? 'running' : 'stopped',
                exit_code: procData.process.exitCode,
                uptime_ms: uptime,
                uptime_seconds: Math.floor(uptime / 1000),
                log_line_count: procData.logs.length
            };
            
            return {
                success: true,
                stdout: `Process Status:\n${JSON.stringify(status, null, 2)}\n\nRecent Logs:\n${recentLogs}`,
                process_status: status,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error monitoring process:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Stop a background process (Phase 4)
     */
    async executeStopProcess(args) {
        const { process_id, force = false } = args;
        
        console.log(`[PullExecutor] Stopping process: ${process_id} (force: ${force})`);
        
        try {
            if (!this.backgroundProcesses || !this.backgroundProcesses.has(process_id)) {
                return {
                    success: false,
                    error: `Process not found: ${process_id}`,
                    exit_code: 1
                };
            }
            
            const procData = this.backgroundProcesses.get(process_id);
            const proc = procData.process;
            
            if (proc.exitCode !== null) {
                return {
                    success: true,
                    stdout: `Process already stopped with exit code ${proc.exitCode}`,
                    exit_code: 0
                };
            }
            
            // Try graceful shutdown first
            if (!force) {
                proc.kill('SIGTERM');
                
                // Wait up to 5 seconds for graceful shutdown
                const timeout = 5000;
                const startWait = Date.now();
                
                while (proc.exitCode === null && Date.now() - startWait < timeout) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                if (proc.exitCode !== null) {
                    this.backgroundProcesses.delete(process_id);
                    return {
                        success: true,
                        stdout: `Process stopped gracefully (exit code ${proc.exitCode})`,
                        exit_code: 0
                    };
                }
            }
            
            // Force kill if graceful failed or force=true
            proc.kill('SIGKILL');
            
            // Wait a moment for kill to take effect
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.backgroundProcesses.delete(process_id);
            
            return {
                success: true,
                stdout: `Process force killed`,
                exit_code: 0
            };
            
        } catch (error) {
            console.error(`[PullExecutor] Error stopping process:`, error);
            return {
                success: false,
                error: error.message,
                exit_code: 1
            };
        }
    }

    /**
     * Report step result to cloud
     */
    async reportStepResult(runId, stepIndex, result) {
        const url = `${this.apiClient.baseUrl}/api/v2/runs/${runId}/steps/${stepIndex}/result`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiClient.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result)
            });

            if (!response.ok) {
                throw new Error(`Failed to report result: ${response.status}`);
            }

            const reported = await response.json();
            console.log(`[PullExecutor] Result reported: ${reported.status}`);
            return reported;
        } catch (error) {
            console.error(`[PullExecutor] Error reporting result:`, error);
            // Don't throw - desktop continues even if cloud unavailable
            return { status: 'error', error: error.message };
        }
    }

    /**
     * Stop execution and cleanup background processes
     */
    stop() {
        console.log(`[PullExecutor] Stopping execution`);
        this.isRunning = false;
        
        // Cleanup background processes
        if (this.backgroundProcesses && this.backgroundProcesses.size > 0) {
            console.log(`[PullExecutor] Cleaning up ${this.backgroundProcesses.size} background processes`);
            for (const [processId, procData] of this.backgroundProcesses.entries()) {
                try {
                    if (procData.process.exitCode === null) {
                        console.log(`[PullExecutor] Killing background process ${processId} (PID: ${procData.process.pid})`);
                        procData.process.kill('SIGTERM');
                    }
                } catch (error) {
                    console.error(`[PullExecutor] Error killing process ${processId}:`, error);
                }
            }
            this.backgroundProcesses.clear();
        }
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { PullExecutor };
