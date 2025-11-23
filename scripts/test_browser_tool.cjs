#!/usr/bin/env node

/**
 * Test script for browser and think tools in pull execution
 * Tests end-to-end: plan generation → tool execution → result reporting
 */

const API_KEY = process.env.VITE_API_KEY || 'e341a4acb41aa9c80b4baba442b0a24e8d1ce9fa7b4e5307ed34ef2aa15258f0';
const BASE_URL = 'https://agentmax-production.up.railway.app';

async function testBrowserTool() {
    console.log('\n🧪 Testing Browser Tool with Pull Execution\n');
    console.log('='.repeat(60));
    
    // Step 1: Create a run
    console.log('\n📝 Step 1: Creating run...');
    const createResponse = await fetch(`${BASE_URL}/api/v2/runs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-User-Id': 'test_user'
        },
        body: JSON.stringify({
            message: 'get the current weather in Philadelphia',
            context: {},
            mode: 'autonomous',
            execution_mode: 'pull'
        })
    });
    
    if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Failed to create run: ${createResponse.status} ${error}`);
    }
    
    const run = await createResponse.json();
    console.log(`✅ Run created: ${run.run_id}`);
    console.log(`   Status: ${run.status}`);
    console.log(`   Total steps: ${run.total_steps}`);
    
    if (run.plan && run.plan.steps) {
        console.log(`\n📋 Plan generated:`);
        run.plan.steps.forEach((step, i) => {
            console.log(`   ${i + 1}. [${step.tool_name}] ${step.description}`);
        });
        console.log(`   Goal: ${run.plan.goal_summary}`);
    }
    
    // Step 2: Get next step
    console.log('\n📥 Step 2: Pulling next step...');
    const nextStepResponse = await fetch(`${BASE_URL}/api/v2/runs/${run.run_id}/next-step`, {
        headers: {
            'X-API-Key': API_KEY
        }
    });
    
    if (!nextStepResponse.ok) {
        const error = await nextStepResponse.text();
        throw new Error(`Failed to get next step: ${nextStepResponse.status} ${error}`);
    }
    
    const nextStep = await nextStepResponse.json();
    console.log(`✅ Next step: ${nextStep.step_index}`);
    console.log(`   Tool: ${nextStep.tool_name}`);
    console.log(`   Description: ${nextStep.description}`);
    
    // Step 3: Simulate tool execution (browser search)
    console.log('\n🔍 Step 3: Executing browser tool...');
    
    // Simulate what the pullExecutor does
    const query = 'weather Philadelphia';
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        let result = `Search results for: ${query}\n\n`;
        
        if (searchData.AbstractText) {
            result += `Summary: ${searchData.AbstractText}\n`;
            if (searchData.AbstractURL) {
                result += `Source: ${searchData.AbstractURL}\n`;
            }
        }
        
        if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
            result += `\nRelated Topics:\n`;
            searchData.RelatedTopics.slice(0, 3).forEach((topic, i) => {
                if (topic.Text) {
                    result += `${i + 1}. ${topic.Text}\n`;
                }
            });
        }
        
        console.log(`✅ Browser search completed`);
        console.log(`   Results:\n${result.split('\n').map(l => `   ${l}`).join('\n')}`);
        
        // Step 4: Report result
        console.log('\n📤 Step 4: Reporting result to backend...');
        const reportResponse = await fetch(`${BASE_URL}/api/v2/runs/${run.run_id}/steps/${nextStep.step_index}/result`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                success: true,
                stdout: result,
                stderr: '',
                exit_code: 0
            })
        });
        
        if (!reportResponse.ok) {
            const error = await reportResponse.text();
            console.log(`⚠️  Failed to report result: ${reportResponse.status} ${error}`);
        } else {
            console.log(`✅ Result reported successfully`);
        }
        
    } catch (error) {
        console.error(`❌ Browser tool failed: ${error.message}`);
        throw error;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!\n');
}

async function testFileWrite() {
    console.log('\n🧪 Testing File Write Tool with Pull Execution\n');
    console.log('='.repeat(60));
    
    // Create a run for file writing
    console.log('\n📝 Creating run for file write test...');
    const createResponse = await fetch(`${BASE_URL}/api/v2/runs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY,
            'X-User-Id': 'test_user'
        },
        body: JSON.stringify({
            message: 'create a file called test.txt on the desktop with hello world',
            context: {},
            mode: 'autonomous',
            execution_mode: 'pull'
        })
    });
    
    if (!createResponse.ok) {
        const error = await createResponse.text();
        throw new Error(`Failed to create run: ${createResponse.status} ${error}`);
    }
    
    const run = await createResponse.json();
    console.log(`✅ Run created: ${run.run_id}`);
    console.log(`   Total steps: ${run.total_steps}`);
    
    if (run.plan && run.plan.steps) {
        console.log(`\n📋 Plan generated:`);
        run.plan.steps.forEach((step, i) => {
            console.log(`   ${i + 1}. [${step.tool_name}] ${step.description}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ File write test plan generated!\n');
}

// Run tests
(async () => {
    try {
        await testBrowserTool();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await testFileWrite();
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
})();
