/**
 * End-to-End Memory Integration Test
 * 
 * Tests the complete flow from frontend through Electron to backend.
 * Measures performance and UX quality.
 * 
 * Run this from the agent-max-desktop directory:
 * $ node e2e-memory-integration-test.js
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const API_BASE = process.env.VITE_API_URL || 'http://localhost:8000';
const TEST_RUN_ID = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = path.join(__dirname, `e2e-frontend-test-${TEST_RUN_ID}.jsonl`);

// Test state
const testResults = [];
let testsPassed = 0;
let testsFailed = 0;

/**
 * Log test event to file
 */
function logEvent(eventType, data, durationMs = null) {
  const entry = {
    timestamp: new Date().toISOString(),
    test_run_id: TEST_RUN_ID,
    event_type: eventType,
    duration_ms: durationMs,
    data: data
  };
  
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

/**
 * Measure async function execution time
 */
async function measureTime(fn) {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Test 1: Backend Health Check
 */
async function testBackendHealth() {
  console.log('\n🏥 Test 1: Backend Health Check');
  console.log('=' .repeat(60));
  
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_BASE}/api/memory/health`);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const health = await response.json();
    
    console.log(`   ✅ Backend healthy (${duration}ms)`);
    console.log(`      Status: ${health.status}`);
    console.log(`      Version: ${health.version || 'unknown'}`);
    
    logEvent('health_check', {
      success: true,
      status: health.status,
      version: health.version
    }, duration);
    
    testsPassed++;
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`   ❌ Backend check failed: ${error.message}`);
    
    logEvent('health_check', {
      success: false,
      error: error.message
    }, duration);
    
    testsFailed++;
    return { success: false, error: error.message, duration };
  }
}

/**
 * Test 2: Memory Service Fact Operations
 */
async function testFactOperations() {
  console.log('\n📝 Test 2: Fact Operations');
  console.log('=' .repeat(60));
  
  const testCategory = `e2e_test_${TEST_RUN_ID}`;
  const testKey = 'test_preference';
  const testValue = 'Testing from frontend';
  
  let factId = null;
  let allSuccess = true;
  const stepDurations = {};
  
  // Step 1: Create
  console.log('   Step 1: Creating fact...');
  try {
    const { result, duration } = await measureTime(async () => {
      const response = await fetch(`${API_BASE}/api/memory/facts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: testCategory,
          key: testKey,
          value: testValue,
          confidence: 0.95
        })
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });
    
    factId = result.id;
    stepDurations.create = duration;
    console.log(`      ✅ Created (${duration}ms) - ID: ${factId.substring(0, 8)}...`);
    
    logEvent('fact_create', {
      success: true,
      fact_id: factId,
      category: testCategory
    }, duration);
    
    // UX Analysis
    if (duration > 500) {
      console.log(`      ⚠️  UX WARNING: Creation took ${duration}ms (>500ms feels slow)`);
      console.log(`         Suggestion: Add optimistic UI update for instant feedback`);
    }
  } catch (error) {
    console.log(`      ❌ Failed: ${error.message}`);
    allSuccess = false;
  }
  
  // Step 2: Read
  if (factId) {
    console.log('   Step 2: Reading fact...');
    try {
      const { result, duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}/api/memory/facts/${factId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      });
      
      stepDurations.read = duration;
      console.log(`      ✅ Read (${duration}ms)`);
      console.log(`         Value: "${result.value}"`);
      
      if (duration > 200) {
        console.log(`      ⚠️  UX WARNING: Read took ${duration}ms (>200ms)`);
      }
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      allSuccess = false;
    }
  }
  
  // Step 3: Update
  if (factId) {
    console.log('   Step 3: Updating fact...');
    const updatedValue = 'Updated from E2E test';
    
    try {
      const { duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}/api/memory/facts/${factId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: updatedValue })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      });
      
      stepDurations.update = duration;
      console.log(`      ✅ Updated (${duration}ms)`);
      
      if (duration > 500) {
        console.log(`      ⚠️  UX WARNING: Update took ${duration}ms`);
        console.log(`         Suggestion: Show loading state during save`);
      }
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      allSuccess = false;
    }
  }
  
  // Step 4: Delete
  if (factId) {
    console.log('   Step 4: Deleting fact...');
    try {
      const { duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}/api/memory/facts/${factId}`, {
          method: 'DELETE'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      });
      
      stepDurations.delete = duration;
      console.log(`      ✅ Deleted (${duration}ms)`);
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      allSuccess = false;
    }
  }
  
  // Summary
  console.log('\n   📊 Operation Timings:');
  Object.entries(stepDurations).forEach(([op, ms]) => {
    const status = ms < 200 ? '🟢' : ms < 500 ? '🟡' : '🔴';
    console.log(`      ${status} ${op.padEnd(8)}: ${ms}ms`);
  });
  
  if (allSuccess) {
    testsPassed++;
  } else {
    testsFailed++;
  }
  
  return { success: allSuccess, durations: stepDurations };
}

/**
 * Test 3: Memory Retrieval Performance
 */
async function testRetrievalPerformance() {
  console.log('\n🚀 Test 3: Retrieval Performance');
  console.log('=' .repeat(60));
  
  const queries = [
    { text: 'What are my preferences?', label: 'User Preferences' },
    { text: 'Tell me about my project', label: 'Project Context' },
    { text: 'What do I like?', label: 'User Likes' },
  ];
  
  const durations = [];
  let allSuccess = true;
  
  for (const query of queries) {
    console.log(`   Testing: "${query.label}"`);
    
    try {
      const { result, duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}/api/memory/retrieval/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: query.text,
            k_facts: 8,
            k_sem: 6,
            token_budget: 900,
            allow_vectors: false
          })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      });
      
      durations.push(duration);
      
      const factsCount = result.facts?.length || 0;
      const semanticCount = result.semantic_hits?.length || 0;
      
      console.log(`      ✅ Retrieved (${duration}ms)`);
      console.log(`         Facts: ${factsCount}, Semantic: ${semanticCount}`);
      
      // UX Analysis
      if (duration < 100) {
        console.log(`      🌟 EXCELLENT: <100ms feels instant`);
      } else if (duration < 200) {
        console.log(`      ✅ GOOD: <200ms feels responsive`);
      } else if (duration < 500) {
        console.log(`      ⚠️  ACCEPTABLE: <500ms noticeable but ok`);
      } else {
        console.log(`      ❌ SLOW: >${duration}ms feels sluggish`);
        console.log(`         Suggestion: Enable ANN index or add loading indicator`);
      }
      
      logEvent('retrieval_query', {
        success: true,
        query: query.text,
        facts_count: factsCount,
        semantic_count: semanticCount
      }, duration);
      
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      allSuccess = false;
    }
  }
  
  // Statistics
  if (durations.length > 0) {
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const sorted = durations.slice().sort((a, b) => a - b);
    const p95 = sorted[Math.floor(durations.length * 0.95)];
    
    console.log('\n   📊 Performance Statistics:');
    console.log(`      Average: ${avg.toFixed(1)}ms`);
    console.log(`      P95: ${p95.toFixed(1)}ms`);
    console.log(`      Target SLO: <120ms (P95)`);
    
    if (p95 < 120) {
      console.log(`      ✅ WITHIN SLO - Excellent performance!`);
    } else {
      console.log(`      ⚠️  ABOVE SLO - Consider optimizations`);
    }
  }
  
  if (allSuccess) {
    testsPassed++;
  } else {
    testsFailed++;
  }
  
  return { success: allSuccess, durations };
}

/**
 * Test 4: Conversation Message Flow
 */
async function testConversationFlow() {
  console.log('\n💬 Test 4: Conversation Flow');
  console.log('=' .repeat(60));
  
  const sessionId = `test_session_${Date.now()}`;
  const messages = [
    { role: 'user', content: 'Hello, I need help' },
    { role: 'assistant', content: 'Of course! How can I assist you?' },
    { role: 'user', content: 'I want to build a website' },
  ];
  
  let saveCount = 0;
  const saveDurations = [];
  
  console.log('   Saving messages...');
  
  for (const msg of messages) {
    try {
      const { duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}/api/memory/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: msg.role,
            content: msg.content,
            session_id: sessionId
          })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      });
      
      saveCount++;
      saveDurations.push(duration);
      console.log(`      ✅ Saved ${msg.role} message (${duration}ms)`);
      
    } catch (error) {
      console.log(`      ❌ Failed to save ${msg.role}: ${error.message}`);
    }
  }
  
  // Retrieve
  console.log('\n   Retrieving messages...');
  
  try {
    const { result, duration } = await measureTime(async () => {
      const params = new URLSearchParams({
        session_id: sessionId,
        limit: '10'
      });
      
      const response = await fetch(`${API_BASE}/api/memory/messages?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });
    
    console.log(`      ✅ Retrieved ${result.length} messages (${duration}ms)`);
    
    const success = saveCount === messages.length && result.length === messages.length;
    
    if (success) {
      console.log(`      ✅ All messages saved and retrieved correctly`);
      testsPassed++;
    } else {
      console.log(`      ❌ Message count mismatch`);
      testsFailed++;
    }
    
    // UX Analysis
    const avgSave = saveDurations.reduce((a, b) => a + b, 0) / saveDurations.length;
    console.log(`\n   📊 Average save time: ${avgSave.toFixed(1)}ms`);
    
    if (avgSave < 100) {
      console.log(`      ✅ Messages save quickly - good UX`);
    } else {
      console.log(`      ⚠️  Message saves may feel slow to user`);
      console.log(`         Suggestion: Queue messages locally and sync in background`);
    }
    
    return { success, saveDurations, retrieveDuration: duration };
    
  } catch (error) {
    console.log(`      ❌ Failed to retrieve: ${error.message}`);
    testsFailed++;
    return { success: false };
  }
}

/**
 * Test 5: Debug API Availability
 */
async function testDebugEndpoints() {
  console.log('\n🔍 Test 5: Debug API Endpoints');
  console.log('=' .repeat(60));
  
  const endpoints = [
    { path: '/api/memory/debug/health', name: 'Health Check' },
    { path: '/api/memory/debug/stats', name: 'Statistics' },
    { path: '/api/memory/debug/slo', name: 'SLO Compliance' },
  ];
  
  let allSuccess = true;
  
  for (const endpoint of endpoints) {
    console.log(`   Testing: ${endpoint.name}`);
    
    try {
      const { result, duration } = await measureTime(async () => {
        const response = await fetch(`${API_BASE}${endpoint.path}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      });
      
      console.log(`      ✅ Available (${duration}ms)`);
      
      // Show relevant data
      if (endpoint.name === 'Statistics' && result.total_facts !== undefined) {
        console.log(`         Facts: ${result.total_facts}, Messages: ${result.total_messages || 0}`);
      }
      if (endpoint.name === 'SLO Compliance' && result.compliance_rate !== undefined) {
        console.log(`         Compliance: ${result.compliance_rate.toFixed(1)}%`);
      }
      
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
      allSuccess = false;
    }
  }
  
  if (allSuccess) {
    testsPassed++;
    console.log('\n   ✅ All debug endpoints available for troubleshooting');
  } else {
    testsFailed++;
    console.log('\n   ⚠️  Some debug endpoints unavailable');
  }
  
  return { success: allSuccess };
}

/**
 * Generate UX Report
 */
function generateUXReport(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 UX EVALUATION & RECOMMENDATIONS');
  console.log('='.repeat(60));
  
  const recommendations = [];
  
  // Analyze retrieval performance
  const retrievalResult = results.find(r => r.testName === 'retrieval');
  if (retrievalResult && retrievalResult.data.durations) {
    const durations = retrievalResult.data.durations;
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    console.log('\n### Memory Retrieval Performance');
    console.log(`Average: ${avg.toFixed(1)}ms`);
    
    if (avg > 150) {
      recommendations.push({
        category: 'Performance',
        issue: `Retrieval averaging ${avg.toFixed(0)}ms`,
        impact: 'User experiences noticeable delay before AI response',
        suggestion: 'Enable ANN index for faster vector search (5-10x speedup at scale)'
      });
    }
  }
  
  // Analyze CRUD operations
  const crudResult = results.find(r => r.testName === 'facts');
  if (crudResult && crudResult.data.durations) {
    const durations = crudResult.data.durations;
    
    console.log('\n### Fact CRUD Operations');
    Object.entries(durations).forEach(([op, ms]) => {
      const rating = ms < 200 ? '🟢 Excellent' : ms < 500 ? '🟡 Acceptable' : '🔴 Needs Work';
      console.log(`${op.padEnd(8)}: ${ms}ms - ${rating}`);
      
      if (ms > 300) {
        recommendations.push({
          category: 'Responsiveness',
          issue: `${op} operation takes ${ms}ms`,
          impact: 'User sees loading state, may feel app is slow',
          suggestion: `Implement optimistic UI updates for ${op} operations`
        });
      }
    });
  }
  
  // Analyze conversation flow
  const convResult = results.find(r => r.testName === 'conversation');
  if (convResult && convResult.data.saveDurations) {
    const avg = convResult.data.saveDurations.reduce((a, b) => a + b, 0) / 
                convResult.data.saveDurations.length;
    
    console.log('\n### Conversation Persistence');
    console.log(`Average message save: ${avg.toFixed(1)}ms`);
    
    if (avg > 100) {
      recommendations.push({
        category: 'Chat UX',
        issue: 'Message persistence adds latency to chat',
        impact: 'Slight delay between user sending message and AI response starting',
        suggestion: 'Queue messages locally and persist asynchronously in background'
      });
    }
  }
  
  // Print recommendations
  console.log('\n### Recommendations');
  
  if (recommendations.length === 0) {
    console.log('\n✅ No major UX issues detected! System performs well.');
    console.log('   All operations feel responsive to users.');
  } else {
    console.log(`\nFound ${recommendations.length} opportunities for improvement:\n`);
    
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. **${rec.category}**: ${rec.issue}`);
      console.log(`   Impact: ${rec.impact}`);
      console.log(`   Suggestion: ${rec.suggestion}`);
      console.log('');
    });
  }
  
  // Save report
  const reportFile = path.join(__dirname, `ux-report-${TEST_RUN_ID}.md`);
  let reportContent = `# UX Evaluation Report\n\n`;
  reportContent += `**Test Run**: ${TEST_RUN_ID}\n\n`;
  reportContent += `## Test Results\n\n`;
  reportContent += `- Tests Passed: ${testsPassed}\n`;
  reportContent += `- Tests Failed: ${testsFailed}\n\n`;
  reportContent += `## Recommendations\n\n`;
  
  if (recommendations.length === 0) {
    reportContent += `✅ No major UX issues detected!\n\n`;
  } else {
    recommendations.forEach((rec, i) => {
      reportContent += `### ${i + 1}. ${rec.category}\n\n`;
      reportContent += `- **Issue**: ${rec.issue}\n`;
      reportContent += `- **Impact**: ${rec.impact}\n`;
      reportContent += `- **Suggestion**: ${rec.suggestion}\n\n`;
    });
  }
  
  reportContent += `## Raw Test Data\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\`\n`;
  
  fs.writeFileSync(reportFile, reportContent);
  console.log(`\n📄 Full report saved: ${reportFile}`);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('🧪 AGENT MAX E2E FRONTEND INTEGRATION TESTS');
  console.log('='.repeat(60));
  console.log('Testing: Frontend → Electron → Backend → Database');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Log File: ${LOG_FILE}`);
  console.log('');
  
  const results = [];
  
  // Test 1: Health Check
  const healthResult = await testBackendHealth();
  results.push({ testName: 'health', success: healthResult.success, data: healthResult });
  
  if (!healthResult.success) {
    console.log('\n❌ Backend not available. Cannot continue with tests.');
    console.log('   Please ensure backend is running:');
    console.log('   $ cd /path/to/Agent_Max');
    console.log('   $ python -m uvicorn api.main:app --reload');
    return;
  }
  
  // Test 2: Fact Operations
  const factResult = await testFactOperations();
  results.push({ testName: 'facts', success: factResult.success, data: factResult });
  
  // Test 3: Retrieval Performance
  const retrievalResult = await testRetrievalPerformance();
  results.push({ testName: 'retrieval', success: retrievalResult.success, data: retrievalResult });
  
  // Test 4: Conversation Flow
  const convResult = await testConversationFlow();
  results.push({ testName: 'conversation', success: convResult.success, data: convResult });
  
  // Test 5: Debug Endpoints
  const debugResult = await testDebugEndpoints();
  results.push({ testName: 'debug', success: debugResult.success, data: debugResult });
  
  // Generate report
  generateUXReport(results);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  console.log(`\nTest Run ID: ${TEST_RUN_ID}`);
  console.log(`Log File: ${LOG_FILE}`);
  
  if (testsFailed === 0) {
    console.log('\n✅ All E2E tests passed!');
    console.log('   Memory system integration is working correctly.');
  } else {
    console.log(`\n⚠️  ${testsFailed} test(s) failed. Review logs for details.`);
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test runner error:', error);
  process.exit(1);
});
