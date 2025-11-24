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
                        execution_time_ms: executionTime
                    };
                    
                    // Store result for future placeholder resolution
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
     * Execute file write
     */
    async executeFileWrite(args, step) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');

        try {
            // Extract args - trust AI to provide correct values
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
     * Stop execution
     */
    stop() {
        console.log(`[PullExecutor] Stopping execution`);
        this.isRunning = false;
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { PullExecutor };
