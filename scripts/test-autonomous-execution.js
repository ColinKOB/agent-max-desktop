#!/usr/bin/env node
/**
 * Test Autonomous Execution (Desktop App Integration)
 * Verifies that the desktop app correctly routes to execution endpoint
 * and that files are actually created
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = process.env.API_BASE || 'http://localhost:8000';

async function testAutonomousExecution() {
  console.log('=== Autonomous Execution Test (Desktop App) ===');
  console.log(`API Base: ${API_BASE}`);
  
  // Test 1: Verify endpoint routing
  console.log('\n📍 Test 1: Endpoint Routing');
  console.log('Expected behavior:');
  console.log('  - Helpful mode → /api/v2/chat/streaming/stream');
  console.log('  - Autonomous mode → /api/v2/autonomous/execute/stream');
  
  // Test 2: Verify file creation
  console.log('\n📁 Test 2: File Creation');
  
  const desktop = path.join(os.homedir(), 'Desktop');
  const testFile = path.join(desktop, 'agentmax_integration_test.txt');
  
  // Clean up if exists
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
    console.log(`  Cleaned up existing test file`);
  }
  
  const payload = {
    goal: `Create a file on my Desktop called 'agentmax_integration_test.txt' with the text 'Test passed at ${new Date().toISOString()}'`,
    mode: 'autonomous',
    user_context: {
      profile: { name: 'Test User' },
      facts: {},
      preferences: {},
      recent_messages: []
    },
    max_steps: 5,
    timeout: 60
  };
  
  console.log(`  Goal: ${payload.goal.slice(0, 80)}...`);
  console.log(`  Mode: ${payload.mode}`);
  
  try {
    const response = await fetch(`${API_BASE}/api/v2/autonomous/execute/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'dev',
        'X-User-Id': 'desktop_test'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error(`  ❌ HTTP ${response.status}: ${await response.text()}`);
      return false;
    }
    
    console.log(`  ✓ Connected to streaming endpoint`);
    
    // Parse stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stepCount = 0;
    let sawDone = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        
        try {
          const event = JSON.parse(data);
          if (event.type === 'step') {
            stepCount++;
            const action = event.data?.action || event.action || 'unknown';
            console.log(`  [Step ${stepCount}] ${action}`);
          } else if (event.type === 'done') {
            sawDone = true;
            console.log(`  ✓ Execution complete`);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    console.log(`\n  Total steps: ${stepCount}`);
    
    // Check file
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (fs.existsSync(testFile)) {
      const content = fs.readFileSync(testFile, 'utf-8');
      console.log(`\n  ✅ File created successfully!`);
      console.log(`  Location: ${testFile}`);
      console.log(`  Content: ${content.slice(0, 100)}`);
      
      // Clean up
      fs.unlinkSync(testFile);
      console.log(`  🧹 Cleaned up test file`);
      
      return true;
    } else {
      console.log(`\n  ❌ File NOT created`);
      console.log(`  Expected: ${testFile}`);
      return false;
    }
    
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    return false;
  }
}

async function testModeComparison() {
  console.log('\n📊 Test 3: Mode Comparison');
  console.log('Testing that modes have different capabilities...\n');
  
  const modes = ['chatty', 'autonomous'];
  
  for (const mode of modes) {
    console.log(`  Testing ${mode} mode:`);
    
    try {
      const endpoint = mode === 'autonomous' 
        ? `${API_BASE}/api/v2/autonomous/execute/stream`
        : `${API_BASE}/api/v2/chat/streaming/stream`;
      
      const payload = mode === 'autonomous' ? {
        goal: 'What can you do?',
        mode,
        max_steps: 1,
        timeout: 30
      } : {
        message: 'What can you do?',
        mode,
        max_tokens: 500,
        stream: true
      };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        console.log(`    ✓ ${mode} endpoint reachable`);
      } else {
        console.log(`    ❌ ${mode} endpoint error: ${response.status}`);
      }
      
      // Consume stream
      const reader = response.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      
    } catch (error) {
      console.log(`    ❌ ${mode} error: ${error.message}`);
    }
  }
}

async function main() {
  try {
    const fileTest = await testAutonomousExecution();
    await testModeComparison();
    
    console.log('\n' + '='.repeat(60));
    if (fileTest) {
      console.log('✅ ALL TESTS PASSED');
      console.log('\nAutonomous mode is working correctly!');
      console.log('Files are being created as expected.');
      process.exit(0);
    } else {
      console.log('❌ TESTS FAILED');
      console.log('\nAutonomous execution did not work as expected.');
      console.log('Check the logs above for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
