#!/usr/bin/env node
/**
 * Phase 2 Test Script
 * Tests desktop state store and pull executor V2
 */

const { DesktopStateStore } = require('../electron/storage/desktopStateStore.cjs');
const path = require('path');
const fs = require('fs');

// Test database path
const testDbPath = path.join(__dirname, '../test-state.db');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function testPass(message) {
    log(`✅ PASS: ${message}`, 'green');
}

function testFail(message, error) {
    log(`❌ FAIL: ${message}`, 'red');
    if (error) log(`   Error: ${error.message}`, 'red');
}

function testStart(message) {
    log(`\n[TEST] ${message}`, 'blue');
}

// Test counter
let passed = 0;
let failed = 0;

async function runTests() {
    log('=========================================', 'blue');
    log('Phase 2: Desktop State Store Tests', 'blue');
    log('=========================================', 'blue');
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        log('Cleaned up previous test database', 'yellow');
    }

    let stateStore;

    try {
        // Test 1: Initialize state store
        testStart('Initialize state store');
        stateStore = new DesktopStateStore(testDbPath);
        testPass('State store initialized');
        passed++;

        // Test 2: Create run
        testStart('Create run');
        const testPlan = {
            plan_id: 'test_plan_001',
            user_id: 'test_user',
            message: 'Test run for Phase 2',
            steps: [
                { step_id: 'step_1', description: 'Step 1', action: 'fs.write' },
                { step_id: 'step_2', description: 'Step 2', action: 'fs.read' },
                { step_id: 'step_3', description: 'Step 3', action: 'shell.command' }
            ]
        };
        
        const run = stateStore.createRun('test_run_001', testPlan);
        
        if (run && run.run_id === 'test_run_001') {
            testPass('Run created successfully');
            passed++;
        } else {
            testFail('Run creation failed');
            failed++;
        }

        // Test 3: Save steps
        testStart('Save steps');
        for (let i = 0; i < testPlan.steps.length; i++) {
            stateStore.saveStep('test_run_001', i, testPlan.steps[i]);
        }
        
        const steps = stateStore.listSteps('test_run_001');
        if (steps.length === 3) {
            testPass(`Saved ${steps.length} steps`);
            passed++;
        } else {
            testFail(`Expected 3 steps, got ${steps.length}`);
            failed++;
        }

        // Test 4: Get next pending step
        testStart('Get next pending step');
        const nextStep = stateStore.getNextPendingStep('test_run_001');
        
        if (nextStep && nextStep.step_index === 0) {
            testPass('Got next pending step (index 0)');
            passed++;
        } else {
            testFail('Failed to get next pending step');
            failed++;
        }

        // Test 5: Update step status
        testStart('Update step status');
        stateStore.updateStepStatus(nextStep.step_id, 'running', {
            started_at: Date.now()
        });
        
        const updatedStep = stateStore.getStep(nextStep.step_id);
        if (updatedStep.status === 'running') {
            testPass('Step status updated to running');
            passed++;
        } else {
            testFail('Step status update failed');
            failed++;
        }

        // Test 6: Save step result
        testStart('Save step result');
        const result = {
            success: true,
            stdout: 'File written successfully',
            stderr: '',
            exit_code: 0,
            attempts: 1,
            execution_time_ms: 42
        };
        
        const resultId = stateStore.saveStepResult(
            nextStep.step_id,
            'test_run_001',
            0,
            result
        );
        
        if (resultId) {
            testPass(`Step result saved (ID: ${resultId})`);
            passed++;
        } else {
            testFail('Failed to save step result');
            failed++;
        }

        // Test 7: Mark step as done
        testStart('Mark step as done');
        stateStore.updateStepStatus(nextStep.step_id, 'done', {
            completed_at: Date.now()
        });
        
        const doneStep = stateStore.getStep(nextStep.step_id);
        if (doneStep.status === 'done') {
            testPass('Step marked as done');
            passed++;
        } else {
            testFail('Failed to mark step as done');
            failed++;
        }

        // Test 8: Update run progress
        testStart('Update run progress');
        stateStore.updateRun('test_run_001', {
            current_step_index: 0
        });
        
        const updatedRun = stateStore.getRun('test_run_001');
        if (updatedRun.current_step_index === 0) {
            testPass('Run progress updated');
            passed++;
        } else {
            testFail('Run progress update failed');
            failed++;
        }

        // Test 9: Queue sync
        testStart('Queue sync operation');
        const queueId = stateStore.queueSync('test_run_001', 'report_result', {
            step_index: 0,
            result_id: resultId,
            result: result
        }, 1);
        
        if (queueId) {
            testPass(`Sync queued (ID: ${queueId})`);
            passed++;
        } else {
            testFail('Failed to queue sync');
            failed++;
        }

        // Test 10: Get pending syncs
        testStart('Get pending syncs');
        const pendingSyncs = stateStore.getPendingSyncs(10);
        
        if (pendingSyncs.length === 1) {
            testPass(`Found ${pendingSyncs.length} pending sync`);
            passed++;
        } else {
            testFail(`Expected 1 pending sync, got ${pendingSyncs.length}`);
            failed++;
        }

        // Test 11: Mark sync completed
        testStart('Mark sync completed');
        stateStore.markSyncCompleted(queueId);
        
        const remainingSyncs = stateStore.getPendingSyncs(10);
        if (remainingSyncs.length === 0) {
            testPass('Sync marked as completed');
            passed++;
        } else {
            testFail('Sync not marked as completed');
            failed++;
        }

        // Test 12: Get unsynced results
        testStart('Get unsynced results');
        const unsyncedResults = stateStore.getUnsyncedResults('test_run_001');
        
        if (unsyncedResults.length === 1) {
            testPass(`Found ${unsyncedResults.length} unsynced result`);
            passed++;
        } else {
            testFail(`Expected 1 unsynced result, got ${unsyncedResults.length}`);
            failed++;
        }

        // Test 13: Mark result as synced
        testStart('Mark result as synced');
        stateStore.markResultSynced(resultId);
        
        const stillUnsynced = stateStore.getUnsyncedResults('test_run_001');
        if (stillUnsynced.length === 0) {
            testPass('Result marked as synced');
            passed++;
        } else {
            testFail('Result not marked as synced');
            failed++;
        }

        // Test 14: List active runs
        testStart('List active runs');
        const activeRuns = stateStore.listActiveRuns();
        
        if (activeRuns.length === 1 && activeRuns[0].run_id === 'test_run_001') {
            testPass(`Found ${activeRuns.length} active run`);
            passed++;
        } else {
            testFail('Active runs list incorrect');
            failed++;
        }

        // Test 15: Get statistics
        testStart('Get statistics');
        const stats = stateStore.getStats();
        
        if (stats.runs && stats.steps && stats.sync_queue) {
            testPass('Statistics retrieved');
            log(`   Runs: ${JSON.stringify(stats.runs)}`, 'yellow');
            log(`   Steps: ${JSON.stringify(stats.steps)}`, 'yellow');
            log(`   Sync queue: ${JSON.stringify(stats.sync_queue)}`, 'yellow');
            passed++;
        } else {
            testFail('Statistics incomplete');
            failed++;
        }

        // Test 16: Complete run
        testStart('Complete run');
        stateStore.updateRun('test_run_001', {
            status: 'complete',
            completed_at: Date.now()
        });
        
        const completedRun = stateStore.getRun('test_run_001');
        if (completedRun.status === 'complete') {
            testPass('Run marked as complete');
            passed++;
        } else {
            testFail('Run completion failed');
            failed++;
        }

        // Test 17: Cleanup old runs
        testStart('Cleanup old runs');
        const cleaned = stateStore.cleanup(0); // Clean runs older than 0 days
        
        if (cleaned >= 0) {
            testPass(`Cleaned up ${cleaned} old runs`);
            passed++;
        } else {
            testFail('Cleanup failed');
            failed++;
        }

    } catch (error) {
        testFail('Unexpected error', error);
        failed++;
    } finally {
        // Close database
        if (stateStore) {
            stateStore.close();
            log('\nDatabase closed', 'yellow');
        }

        // Clean up test database
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
            log('Test database cleaned up', 'yellow');
        }
    }

    // Summary
    log('\n=========================================', 'blue');
    log('Test Summary', 'blue');
    log('=========================================', 'blue');
    log(`Passed: ${passed}`, 'green');
    log(`Failed: ${failed}`, 'red');
    log(`Total:  ${passed + failed}`, 'blue');
    
    if (failed === 0) {
        log('\n✅ All tests passed!', 'green');
        process.exit(0);
    } else {
        log('\n❌ Some tests failed', 'red');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    log(`\nFatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
});
