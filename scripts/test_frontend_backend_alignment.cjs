#!/usr/bin/env node
/**
 * Test Frontend-Backend Alignment
 * 
 * Verifies that frontend and backend are properly aligned:
 * 1. API endpoint paths match
 * 2. Request/response formats compatible
 * 3. Plan data properly received and stored
 */

const API_BASE = process.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';
const API_KEY = process.env.VITE_API_KEY || process.env.AMX_API_KEY;

console.log('🔍 Testing Frontend-Backend Alignment\n');
console.log(`API Base: ${API_BASE}`);
console.log(`API Key: ${API_KEY ? '***' + API_KEY.slice(-4) : 'NOT SET'}\n`);

if (!API_KEY) {
    console.error('❌ No API key provided');
    process.exit(1);
}

async function testAlignment() {
    const tests = {
        passed: 0,
        failed: 0,
        results: []
    };

    function assert(condition, message) {
        if (condition) {
            console.log(`✓ ${message}`);
            tests.passed++;
            tests.results.push({ pass: true, message });
        } else {
            console.log(`✗ ${message}`);
            tests.failed++;
            tests.results.push({ pass: false, message });
        }
    }

    try {
        // Test 1: Endpoint exists
        console.log('\n📡 Test 1: API Endpoint');
        const response = await fetch(`${API_BASE}/api/v2/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                message: 'Test alignment',
                mode: 'autonomous'
            })
        });

        assert(response.ok, 'Endpoint responds successfully');
        assert(response.status === 200, 'Returns 200 status');

        // Test 2: Response format
        console.log('\n📦 Test 2: Response Format');
        const data = await response.json();
        
        assert(data.success === true, 'Response has success field');
        assert(typeof data.run_id === 'string', 'Response has run_id string');
        assert(typeof data.status === 'string', 'Response has status string');
        assert(typeof data.total_steps === 'number', 'Response has total_steps number');
        assert(data.plan !== undefined, 'Response has plan object');

        // Test 3: Plan structure
        console.log('\n📋 Test 3: Plan Structure');
        assert(data.plan.plan_id === data.run_id, 'Plan ID matches run ID');
        assert(Array.isArray(data.plan.steps), 'Plan has steps array');
        assert(data.plan.steps.length > 0, 'Plan has at least one step');
        assert(typeof data.plan.goal_summary === 'string', 'Plan has goal_summary');
        assert(typeof data.plan.definition_of_done === 'string', 'Plan has definition_of_done');

        // Test 4: Step structure
        console.log('\n🔧 Test 4: Step Structure');
        const firstStep = data.plan.steps[0];
        assert(typeof firstStep.step_id === 'string', 'Step has step_id');
        assert(typeof firstStep.description === 'string', 'Step has description');
        assert(typeof firstStep.goal === 'string', 'Step has goal');
        assert(typeof firstStep.tool_name === 'string', 'Step has tool_name');

        // Test 5: Tool names
        console.log('\n🛠️  Test 5: Tool Names');
        const validTools = ['browser', 'fs.write', 'fs.read', 'shell_exec', 'think'];
        const toolsUsed = data.plan.steps.map(s => s.tool_name);
        const allValid = toolsUsed.every(t => validTools.includes(t));
        assert(allValid, `All tools are valid: ${toolsUsed.join(', ')}`);

        // Test 6: Frontend compatibility
        console.log('\n🎨 Test 6: Frontend Compatibility');
        
        // Simulate frontend data structure
        const runTracker = {
            runId: data.run_id,
            status: data.status,
            plan: data.plan,
            steps: data.plan.steps,
            totalSteps: data.total_steps,
            goalSummary: data.plan.goal_summary,
            definitionOfDone: data.plan.definition_of_done
        };

        assert(runTracker.runId === data.run_id, 'Frontend runId matches backend run_id');
        assert(runTracker.steps.length === data.plan.steps.length, 'Frontend steps match backend steps');
        assert(runTracker.totalSteps === data.total_steps, 'Frontend totalSteps matches backend');
        assert(runTracker.goalSummary === data.plan.goal_summary, 'Frontend goalSummary matches backend');

        // Test 7: GPT-5 plan quality
        console.log('\n🤖 Test 7: GPT-5 Plan Quality');
        assert(data.plan.steps.length >= 2, 'Plan has multiple steps (not fallback)');
        assert(data.plan.steps.some(s => s.tool_name !== 'think'), 'Plan uses actual tools (not just think)');
        assert(firstStep.description.length > 20, 'Step descriptions are detailed');

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`✓ Passed: ${tests.passed}`);
        console.log(`✗ Failed: ${tests.failed}`);
        console.log(`Total: ${tests.passed + tests.failed}`);

        if (tests.failed === 0) {
            console.log('\n🎉 All tests passed! Frontend and backend are aligned.');
            console.log('\n📋 Generated Plan:');
            data.plan.steps.forEach((step, i) => {
                console.log(`  ${i + 1}. [${step.tool_name}] ${step.description.substring(0, 80)}...`);
            });
            console.log(`\n🎯 Goal: ${data.plan.goal_summary}`);
            console.log(`✅ Done: ${data.plan.definition_of_done}`);
        } else {
            console.log('\n❌ Some tests failed. Check alignment issues above.');
        }

        return tests.failed === 0;

    } catch (error) {
        console.error('\n❌ Test failed with error:', error.message);
        return false;
    }
}

testAlignment()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
