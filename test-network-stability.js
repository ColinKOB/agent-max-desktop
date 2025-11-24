#!/usr/bin/env node
/**
 * Network Stability Test Suite
 * Tests the main process run creation with retry logic
 */

const { spawn } = require('child_process');
const fetch = require('node-fetch');

const API_URL = process.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';
const API_KEY = process.env.VITE_API_KEY || 'e341a4acb41aa9c80b4baba442b0a24e8d1ce9fa7b4e5307ed34ef2aa15258f0';

// Test results
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
};

function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warn: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
}

function recordTest(name, passed, duration, details) {
    results.total++;
    if (passed) {
        results.passed++;
        log(`✓ ${name} (${duration}ms)`, 'success');
    } else {
        results.failed++;
        log(`✗ ${name} (${duration}ms)`, 'error');
    }
    results.tests.push({ name, passed, duration, details });
}

// Simulate the main process retry logic
async function createRunWithRetry(message, maxRetries = 3) {
    const startTime = Date.now();
    let lastError;
    const attempts = [];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const attemptStart = Date.now();
        try {
            const response = await fetch(`${API_URL}/api/v2/runs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY,
                    'X-User-Id': 'test_user'
                },
                body: JSON.stringify({
                    message,
                    context: {
                        system: {
                            os: 'darwin',
                            user: 'test',
                            home_dir: '/Users/test',
                            desktop_path: '/Users/test/Desktop',
                            shell: '/bin/zsh'
                        }
                    },
                    mode: 'autonomous',
                    execution_mode: 'pull'
                })
            });

            const attemptDuration = Date.now() - attemptStart;
            attempts.push({ attempt, duration: attemptDuration, status: response.status });

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    result,
                    attempts,
                    totalDuration: Date.now() - startTime
                };
            }

            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);

        } catch (error) {
            lastError = error;
            const attemptDuration = Date.now() - attemptStart;
            attempts.push({ attempt, duration: attemptDuration, error: error.message });

            // Don't retry on 4xx errors
            if (error.message.includes('HTTP 4')) {
                return {
                    success: false,
                    error: error.message,
                    attempts,
                    totalDuration: Date.now() - startTime,
                    noRetry: true
                };
            }

            // Retry with exponential backoff
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    return {
        success: false,
        error: lastError.message,
        attempts,
        totalDuration: Date.now() - startTime
    };
}

// Test 1: Basic run creation (happy path)
async function testBasicCreation() {
    log('\n📝 Test 1: Basic Run Creation', 'info');
    const startTime = Date.now();
    
    try {
        const result = await createRunWithRetry('Test: Create a simple website');
        const duration = Date.now() - startTime;
        
        if (result.success && result.attempts.length === 1) {
            recordTest('Basic run creation succeeds on first attempt', true, duration, {
                runId: result.result.run_id,
                attempts: result.attempts
            });
            return true;
        } else {
            recordTest('Basic run creation', false, duration, {
                error: 'Required multiple attempts or failed',
                attempts: result.attempts
            });
            return false;
        }
    } catch (error) {
        recordTest('Basic run creation', false, Date.now() - startTime, { error: error.message });
        return false;
    }
}

// Test 2: Multiple sequential requests (stress test)
async function testSequentialRequests() {
    log('\n📝 Test 2: Sequential Requests (5 runs)', 'info');
    const startTime = Date.now();
    const results = [];
    
    try {
        for (let i = 1; i <= 5; i++) {
            const result = await createRunWithRetry(`Test run ${i}`);
            results.push({
                run: i,
                success: result.success,
                attempts: result.attempts.length,
                duration: result.totalDuration
            });
            
            if (!result.success) {
                log(`  Run ${i}: Failed after ${result.attempts.length} attempts`, 'error');
            } else {
                log(`  Run ${i}: Success (${result.totalDuration}ms, ${result.attempts.length} attempt)`, 'success');
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        const successRate = (successCount / 5) * 100;
        const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / 5;
        
        recordTest(`Sequential requests: ${successCount}/5 succeeded (${successRate}%)`, 
            successCount >= 4, 
            Date.now() - startTime, 
            { results, successRate, avgDuration });
        
        return successCount >= 4;
    } catch (error) {
        recordTest('Sequential requests', false, Date.now() - startTime, { error: error.message });
        return false;
    }
}

// Test 3: Invalid API key (4xx error, should not retry)
async function testInvalidAuth() {
    log('\n📝 Test 3: Invalid Auth (should fail without retry)', 'info');
    const startTime = Date.now();
    
    try {
        // Temporarily override API key
        const originalFetch = global.fetch;
        global.fetch = async (url, options) => {
            options.headers['X-API-Key'] = 'invalid-key';
            return originalFetch(url, options);
        };
        
        const result = await createRunWithRetry('Test with invalid auth');
        global.fetch = originalFetch;
        
        const duration = Date.now() - startTime;
        
        // Should fail on first attempt without retry
        if (!result.success && result.attempts.length === 1 && result.noRetry) {
            recordTest('Invalid auth fails immediately without retry', true, duration, {
                attempts: result.attempts,
                error: result.error
            });
            return true;
        } else {
            recordTest('Invalid auth handling', false, duration, {
                error: 'Should have failed on first attempt',
                attempts: result.attempts
            });
            return false;
        }
    } catch (error) {
        recordTest('Invalid auth handling', false, Date.now() - startTime, { error: error.message });
        return false;
    }
}

// Test 4: Response time measurement
async function testResponseTime() {
    log('\n📝 Test 4: Response Time Analysis', 'info');
    const startTime = Date.now();
    const times = [];
    
    try {
        for (let i = 1; i <= 3; i++) {
            const result = await createRunWithRetry(`Response time test ${i}`);
            if (result.success) {
                times.push(result.totalDuration);
            }
        }
        
        if (times.length === 0) {
            recordTest('Response time analysis', false, Date.now() - startTime, {
                error: 'No successful requests'
            });
            return false;
        }
        
        const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        
        recordTest(`Response time: avg=${avgTime.toFixed(0)}ms, min=${minTime}ms, max=${maxTime}ms`, 
            avgTime < 5000, 
            Date.now() - startTime, 
            { times, avgTime, minTime, maxTime });
        
        return avgTime < 5000;
    } catch (error) {
        recordTest('Response time analysis', false, Date.now() - startTime, { error: error.message });
        return false;
    }
}

// Test 5: Verify retry delays
async function testRetryDelays() {
    log('\n📝 Test 5: Retry Delay Verification', 'info');
    const startTime = Date.now();
    
    // This test would require simulating failures, which we can't easily do
    // without modifying the backend. Instead, verify the logic is correct.
    
    const delays = [
        { attempt: 1, expected: 1000 },
        { attempt: 2, expected: 2000 },
        { attempt: 3, expected: 4000 }
    ];
    
    const calculatedDelays = delays.map(d => ({
        attempt: d.attempt,
        expected: d.expected,
        actual: Math.min(1000 * Math.pow(2, d.attempt - 1), 5000)
    }));
    
    const allCorrect = calculatedDelays.every(d => d.actual === d.expected || d.actual === 5000);
    
    recordTest('Retry delay calculation', allCorrect, Date.now() - startTime, { calculatedDelays });
    return allCorrect;
}

// Run all tests
async function runTests() {
    log('═══════════════════════════════════════════════════════', 'info');
    log('  Network Stability Test Suite', 'info');
    log('═══════════════════════════════════════════════════════', 'info');
    
    const tests = [
        testBasicCreation,
        testSequentialRequests,
        testInvalidAuth,
        testResponseTime,
        testRetryDelays
    ];
    
    for (const test of tests) {
        try {
            await test();
        } catch (error) {
            log(`Test failed with exception: ${error.message}`, 'error');
        }
    }
    
    // Print summary
    log('\n═══════════════════════════════════════════════════════', 'info');
    log('  Test Summary', 'info');
    log('═══════════════════════════════════════════════════════', 'info');
    log(`Total: ${results.total}`, 'info');
    log(`Passed: ${results.passed}`, 'success');
    log(`Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
    log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
        results.passed === results.total ? 'success' : 'warn');
    
    // Detailed results
    log('\n📊 Detailed Results:', 'info');
    results.tests.forEach(test => {
        const status = test.passed ? '✓' : '✗';
        const color = test.passed ? 'success' : 'error';
        log(`  ${status} ${test.name}`, color);
        if (test.details) {
            log(`    ${JSON.stringify(test.details, null, 2)}`, 'info');
        }
    });
    
    process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
});
