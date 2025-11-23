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

                if (reported.status === 'failed') {
                    console.error(`[PullExecutor] Step failed, run terminated`);
                    break;
                }

                lastCompletedStep = nextStep.step_index;
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

        let lastError = null;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[PullExecutor] Attempt ${attempt}/${maxRetries}`);
                const result = await this.executeStep(step, timeoutSec);

                if (result.success) {
                    const executionTime = Date.now() - startTime;
                    return {
                        success: true,
                        stdout: result.stdout,
                        stderr: result.stderr,
                        exit_code: result.exit_code,
                        attempts: attempt,
                        execution_time_ms: executionTime
                    };
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
     * Execute a single step
     */
    async executeStep(step, timeoutSec) {
        const tool = step.tool_name || step.tool;
        const args = step.args || {};

        console.log(`[PullExecutor] Executing: ${tool}`);

        // Handle different tool types
        if (tool === 'shell.command' || tool === 'command' || tool === 'shell_exec') {
            return await this.executeShellCommand(args.command || args.cmd, timeoutSec, step);
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
    async executeShellCommand(command, timeoutSec, step) {
        const os = require('os');
        const path = require('path');
        
        try {
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
            
            const { stdout, stderr } = await execAsync(command, {
                timeout: timeoutSec * 1000,
                maxBuffer: 10 * 1024 * 1024 // 10MB
            });

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
     * Execute file write
     */
    async executeFileWrite(args, step) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');

        try {
            // Helper to check if arg is "NA" or missing
            const isNA = (val) => !val || val === "NA" || val === "na";
            
            // Extract args (skip if "NA")
            let filePath = !isNA(args.filename) ? args.filename : (args.path || args.file_path);
            let content = !isNA(args.content) ? args.content : (args.text || args.data || '');
            const shouldAppend = !isNA(args.append) && args.append === "true";
            const encoding = !isNA(args.encoding) ? args.encoding : 'utf8';

            // If no path provided, try to extract from step description
            if (!filePath && step) {
                const description = step.description || step.goal || '';
                const lower = description.toLowerCase();

                // Collect all quoted strings in order (e.g. 'I love becky', 'She is the greatest')
                const quoted = [];
                const quoteRegex = /["']([^"']+)["']/g;
                let m;
                while ((m = quoteRegex.exec(description)) !== null) {
                    quoted.push(m[1]);
                }

                // Derive filename: if prompt talks about a desktop file "called" or "named",
                // use the FIRST quoted string as the base name, and default to .txt
                if (!filePath && lower.includes('desktop') && (lower.includes('file') || lower.includes('named') || lower.includes('called'))) {
                    let rawName = quoted.length > 0 ? quoted[0] : null;

                    if (!rawName) {
                        const nameMatch = description.match(/(?:named|called)\s+([^\s'".]+)/i);
                        if (nameMatch) rawName = nameMatch[1];
                    }

                    if (rawName) {
                        // Sanitize into a safe filename
                        let safeName = rawName.trim().replace(/[\/]/g, '_').replace(/\s+/g, '_');
                        if (!/\.[a-zA-Z0-9]+$/.test(safeName)) {
                            safeName = safeName + '.txt';
                        }

                        const desktopPath = path.join(os.homedir(), 'Desktop');
                        filePath = path.join(desktopPath, safeName);
                    }
                }

                // Derive content: if there are TWO quoted strings, use the SECOND as content
                if (!content) {
                    if (quoted.length > 1) {
                        content = quoted[1].trim();
                    } else if (quoted.length === 1 && !lower.includes('named') && !lower.includes('called')) {
                        // For descriptions like "containing 'hello world'"
                        content = quoted[0].trim();
                    } else {
                        // Fallback: pattern like "containing X" or "with X"
                        const contentMatch = description.match(/(?:containing|with)\s+(?:the\s+)?(?:text\s+)?['"]?([^'"\n.]+)/i);
                        if (contentMatch) {
                            content = contentMatch[1].trim().replace(/['"]$/, '');
                        }
                    }
                }
            }

            // If we still don't have a filePath but we DO have (or can derive) content,
            // pick a reasonable default on the Desktop so the task can complete.
            if (!filePath && (content || (step && (step.description || step.goal)))) {
                const description = step ? (step.description || step.goal || '') : '';
                // If content is still empty, try one more time to derive from description.
                if (!content && description) {
                    const quoted = [];
                    const quoteRegex = /["']([^"']+)["']/g;
                    let m2;
                    while ((m2 = quoteRegex.exec(description)) !== null) {
                        quoted.push(m2[1]);
                    }
                    if (quoted.length > 0) {
                        content = quoted[quoted.length - 1].trim();
                    }
                }

                const desktopPath = path.join(os.homedir(), 'Desktop');
                let base = 'note';
                if (content) {
                    base = content
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '_')
                        .replace(/^_+|_+$/g, '')
                        .slice(0, 40) || 'note';
                }
                filePath = path.join(desktopPath, `${base}.txt`);
            }

            if (!filePath) {
                throw new Error('No file path specified and could not extract from description');
            }

            if (!content && content !== '') {
                throw new Error('No content specified and could not extract from description');
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
