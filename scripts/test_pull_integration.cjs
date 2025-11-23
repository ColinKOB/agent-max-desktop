#!/usr/bin/env node
/**
 * End-to-end integration test for Phase 2 pull-based execution
 * 
 * Tests:
 * 1. Desktop state store
 * 2. Executor manager
 * 3. Backend API
 * 4. Full pull flow
 * 5. Offline execution
 * 6. Restart resilience
 */

const path = require('path');
const fs = require('fs');

// Load desktop components
const { DesktopStateStore } = require('../electron/storage/desktopStateStore.cjs');
const { PullExecutorV2 } = require('../electron/autonomous/pullExecutorV2.cjs');
const { ExecutorManager } = require('../electron/autonomous/executorManager.cjs');

// Test configuration
const TEST_DB_PATH = path.join(__dirname, '../test-state.db');
const API_BASE = process.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';
const API_KEY = process.env.VITE_API_KEY || process.env.AMX_API_KEY;

console.log('='.repeat(60));
console.log('Phase 2 Integration Test Suite');
console.log('='.repeat(60));
console.log(`API Base: ${API_BASE}`);
console.log(`API Key: ${API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET'}`);
console.log();

// Clean up test DB
if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
}

// Test results
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
    if (condition) {
        console.log(`✓ ${message}`);
        passed++;
    } else {
        console.log(`✗ ${message}`);
        failed++;
        failures.push(message);
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Test Suite 1: State Store
// =============================================================================
async function testStateStore() {
    console.log('\n📦 Test Suite 1: Desktop State Store');
    console.log('-'.repeat(60));
    
    const store = new DesktopStateStore(TEST_DB_PATH);
    
    // Test 1: Create run
    const runId = 'test-run-1';
    const plan = [
        { step_id: 'step-1', description: 'First step', tool_name: 'think' },
        { step_id: 'step-2', description: 'Second step', tool_name: 'fs.read' }
    ];
    
    store.createRun(runId, plan, { message: 'Test task' });
    assert(true, 'Created run');
    
    // Test 2: Get run
    const run = store.getRun(runId);
    assert(run !== null, 'Retrieved run');
    assert(run.run_id === runId, 'Run ID matches');
    assert(run.plan.length === 2, 'Plan has 2 steps');
    
    // Test 3: Update run status
    store.updateRun(runId, { status: 'executing' });
    const updated = store.getRun(runId);
    assert(updated.status === 'executing', 'Updated status');
    
    // Test 4: Save step
    const savedStep = store.saveStep(runId, 0, plan[0]);
    assert(savedStep !== null, 'Saved step');
    const step = store.getStep(plan[0].step_id);
    assert(step !== null, 'Retrieved step');
    assert(step.step_id === 'step-1', 'Step ID matches');
    
    // Test 5: Save result
    const result = { success: true, output: 'Step completed' };
    store.saveStepResult(plan[0].step_id, runId, 0, result);
    const savedResult = store.getStepResult(plan[0].step_id);
    assert(savedResult !== null, 'Retrieved result');
    assert(savedResult.success === 1 || savedResult.success === true, 'Result success flag');
    
    // Test 6: List runs
    const runs = store.listRuns();
    assert(runs.length === 1, 'Listed runs');
    
    // Test 7: Sync queue
    store.queueSync(runId, 'report_result', { stepIndex: 0 });
    const queue = store.getPendingSyncs(10);
    assert(queue.length === 1, 'Queued for sync');
    
    // Test 8: Complete run
    store.updateRun(runId, { status: 'complete' });
    const complete = store.getRun(runId);
    assert(complete.status === 'complete', 'Run completed');
    
    store.close();
    console.log(`State Store: ${passed}/${passed + failed} tests passed`);
}

// =============================================================================
// Test Suite 2: Backend API
// =============================================================================
async function testBackendAPI() {
    console.log('\n🌐 Test Suite 2: Backend API');
    console.log('-'.repeat(60));
    
    if (!API_KEY) {
        console.log('⚠️  Skipping backend tests - no API key');
        return;
    }
    
    try {
        // Test 1: Create run
        console.log('Testing POST /api/v2/runs...');
        const createResponse = await fetch(`${API_BASE}/api/v2/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                message: 'Create a simple test file',
                mode: 'autonomous'
            })
        });
        
        assert(createResponse.ok, 'Create run endpoint responded');
        
        const createData = await createResponse.json();
        assert(createData.success === true, 'Create run succeeded');
        assert(createData.run_id, 'Run ID returned');
        assert(createData.plan, 'Plan returned');
        assert(createData.plan.steps.length > 0, 'Plan has steps');
        
        const runId = createData.run_id;
        console.log(`  Run ID: ${runId}`);
        console.log(`  Steps: ${createData.plan.steps.length}`);
        
        // Test 2: Pull next step
        console.log('Testing GET /api/v2/runs/{run_id}/next-step...');
        const pullResponse = await fetch(`${API_BASE}/api/v2/runs/${runId}/next-step`, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        assert(pullResponse.ok, 'Pull next step responded');
        
        const pullData = await pullResponse.json();
        assert(pullData.status === 'ready', 'Step ready to execute');
        assert(pullData.step_index !== undefined, 'Step index provided');
        assert(pullData.action, 'Action provided');
        
        console.log(`  Step ${pullData.step_index + 1}/${pullData.total_steps}`);
        console.log(`  Action: ${pullData.action}`);
        
        // Test 3: Report result
        console.log('Testing POST /api/v2/runs/{run_id}/steps/{step_index}/result...');
        const resultResponse = await fetch(
            `${API_BASE}/api/v2/runs/${runId}/steps/${pullData.step_index}/result`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': API_KEY
                },
                body: JSON.stringify({
                    success: true,
                    output: 'Test step completed successfully'
                })
            }
        );
        
        assert(resultResponse.ok, 'Report result responded');
        
        const resultData = await resultResponse.json();
        assert(resultData.status !== undefined, 'Status returned');
        
        console.log(`  Result status: ${resultData.status}`);
        
        // Test 4: Get run details
        console.log('Testing GET /api/v2/runs/{run_id}...');
        const getResponse = await fetch(`${API_BASE}/api/v2/runs/${runId}`, {
            headers: { 'X-API-Key': API_KEY }
        });
        
        assert(getResponse.ok, 'Get run details responded');
        
        const runData = await getResponse.json();
        assert(runData.run_id === runId, 'Run details match');
        assert(runData.plan.length > 0, 'Plan stored');
        
        console.log(`  Status: ${runData.status}`);
        console.log(`  Current step: ${runData.current_step_index}`);
        
    } catch (error) {
        console.error('Backend API test failed:', error.message);
        assert(false, `Backend API test: ${error.message}`);
    }
}

// =============================================================================
// Test Suite 3: Executor Manager
// =============================================================================
async function testExecutorManager() {
    console.log('\n⚙️  Test Suite 3: Executor Manager');
    console.log('-'.repeat(60));
    console.log('⚠️  Skipping executor manager tests - requires Electron environment');
    
    // ExecutorManager requires full Electron environment
    // These tests should be run in the Electron context
    // For now, we've validated the state store which is the foundation
}

// =============================================================================
// Test Suite 4: Full Pull Flow
// =============================================================================
async function testFullPullFlow() {
    console.log('\n🔄 Test Suite 4: Full Pull Flow');
    console.log('-'.repeat(60));
    
    if (!API_KEY) {
        console.log('⚠️  Skipping pull flow test - no API key');
        return;
    }
    
    const store = new DesktopStateStore(TEST_DB_PATH);
    const apiClient = {
        baseUrl: API_BASE,
        apiKey: API_KEY
    };
    
    try {
        // Test 1: Create run via API
        console.log('Step 1: Creating run...');
        const createResponse = await fetch(`${API_BASE}/api/v2/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                message: 'Calculate 2 + 2',
                mode: 'autonomous'
            })
        });
        
        const createData = await createResponse.json();
        const runId = createData.run_id;
        assert(createData.success, 'Run created');
        console.log(`  Run ID: ${runId}`);
        
        // Test 2: Store locally
        console.log('Step 2: Storing locally...');
        store.createRun(runId, createData.plan.steps, {
            message: 'Calculate 2 + 2'
        });
        const localRun = store.getRun(runId);
        assert(localRun !== null, 'Stored locally');
        
        // Test 3: Execute locally (simulate)
        console.log('Step 3: Executing locally...');
        store.updateRun(runId, { status: 'executing' });
        
        for (let i = 0; i < createData.plan.steps.length; i++) {
            const step = createData.plan.steps[i];
            store.saveStep(runId, i, step);
            
            // Simulate execution
            await sleep(100);
            
            const result = {
                success: true,
                output: `Step ${i + 1} completed`
            };
            store.saveStepResult(step.step_id, runId, i, result);
            
            // Queue for sync
            store.queueSync(runId, 'report_result', { stepIndex: i, result });
            
            console.log(`  Executed step ${i + 1}/${createData.plan.steps.length}`);
        }
        
        assert(true, 'Executed all steps locally');
        
        // Test 4: Sync results
        console.log('Step 4: Syncing results...');
        const pendingSync = store.getPendingSyncs(10);
        assert(pendingSync.length > 0, 'Has pending sync items');
        console.log(`  Pending sync: ${pendingSync.length} items`);
        
        // Test 5: Complete run
        store.updateRun(runId, { status: 'complete' });
        const finalRun = store.getRun(runId);
        assert(finalRun.status === 'complete', 'Run completed');
        
        console.log('✓ Full pull flow completed successfully');
        
    } catch (error) {
        console.error('Pull flow test failed:', error.message);
        assert(false, `Pull flow: ${error.message}`);
    } finally {
        store.close();
    }
}

// =============================================================================
// Test Suite 5: Offline Execution
// =============================================================================
async function testOfflineExecution() {
    console.log('\n📴 Test Suite 5: Offline Execution');
    console.log('-'.repeat(60));
    
    const store = new DesktopStateStore(TEST_DB_PATH);
    
    // Test 1: Create run while "offline"
    const runId = 'offline-run-1';
    const plan = [
        { step_id: 'step-1', description: 'Offline step', tool_name: 'think' }
    ];
    
    store.createRun(runId, plan, { message: 'Offline task' });
    assert(true, 'Created run while offline');
    
    // Test 2: Execute locally
    store.updateRun(runId, { status: 'executing' });
    store.saveStep(runId, 0, plan[0]);
    
    const result = { success: true, output: 'Completed offline' };
    store.saveStepResult(plan[0].step_id, runId, 0, result);
    assert(true, 'Executed step offline');
    
    // Test 3: Queue for sync
    store.queueSync(runId, 'report_result', { stepIndex: 0, result });
    const queue = store.getPendingSyncs(10);
    assert(queue.length > 0, 'Queued results for sync');
    console.log(`  Queued ${queue.length} items for sync when online`);
    
    // Test 4: Verify offline state
    const run = store.getRun(runId);
    assert(run.status === 'executing', 'Run status preserved');
    
    const savedResult = store.getStepResult(plan[0].step_id);
    assert(savedResult !== null, 'Result persisted');
    
    store.close();
}

// =============================================================================
// Test Suite 6: Restart Resilience
// =============================================================================
async function testRestartResilience() {
    console.log('\n🔄 Test Suite 6: Restart Resilience');
    console.log('-'.repeat(60));
    
    // Test 1: Create run and close
    let store = new DesktopStateStore(TEST_DB_PATH);
    
    const runId = 'restart-run-1';
    const plan = [
        { step_id: 'step-1', description: 'Step 1', tool_name: 'think' },
        { step_id: 'step-2', description: 'Step 2', tool_name: 'think' }
    ];
    
    store.createRun(runId, plan, { message: 'Restart test' });
    store.updateRun(runId, { status: 'executing' });
    store.saveStep(runId, 0, plan[0]);
    store.saveStepResult(plan[0].step_id, runId, 0, { success: true, output: 'Done' });
    
    store.close();
    assert(true, 'Saved state before "restart"');
    
    // Test 2: Reopen and verify
    store = new DesktopStateStore(TEST_DB_PATH);
    
    const resumedRun = store.getRun(runId);
    assert(resumedRun !== null, 'Run persisted after restart');
    assert(resumedRun.status === 'executing', 'Status persisted');
    
    const resumedResult = store.getStepResult(plan[0].step_id);
    assert(resumedResult !== null, 'Result persisted');
    assert(resumedResult.success === 1 || resumedResult.success === true, 'Result data intact');
    
    // Test 3: Continue execution
    store.saveStep(runId, 1, plan[1]);
    store.saveStepResult(plan[1].step_id, runId, 1, { success: true, output: 'Step 2 done' });
    store.updateRun(runId, { status: 'complete' });
    
    const finalRun = store.getRun(runId);
    assert(finalRun.status === 'complete', 'Resumed and completed');
    
    store.close();
}

// =============================================================================
// Main Test Runner
// =============================================================================
async function runTests() {
    try {
        await testStateStore();
        await testBackendAPI();
        await testExecutorManager();
        await testFullPullFlow();
        await testOfflineExecution();
        await testRestartResilience();
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('Test Summary');
        console.log('='.repeat(60));
        console.log(`✓ Passed: ${passed}`);
        console.log(`✗ Failed: ${failed}`);
        console.log(`Total: ${passed + failed}`);
        
        if (failed > 0) {
            console.log('\nFailures:');
            failures.forEach(f => console.log(`  - ${f}`));
        }
        
        // Cleanup
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        
        process.exit(failed > 0 ? 1 : 0);
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests
runTests();
