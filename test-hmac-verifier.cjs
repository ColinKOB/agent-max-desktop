/**
 * Test HMAC Verifier
 * 
 * Tests the frontend HMAC verification implementation
 */

// Set test secret
process.env.HMAC_MASTER_SECRET = 'test-secret-key-for-hmac-testing-12345';

const { HMACVerifier } = require('./electron/hmacVerifier.cjs');

function testHMACVerifier() {
  console.log('\n' + '='.repeat(60));
  console.log('Testing HMAC Verifier (Frontend)');
  console.log('='.repeat(60));

  const verifier = new HMACVerifier();
  verifier.init();

  let passed = 0;
  let failed = 0;

  // Test 1: Sign and verify valid message
  console.log('\n✅ Test 1: Sign and verify valid message');
  const message1 = {
    type: 'RESULT',
    step_id: 'step_001',
    success: true,
    result: { status: 'completed' }
  };

  const signed1 = verifier.sign(message1);
  console.log(`   Signature: ${signed1.signature.substring(0, 20)}...`);

  const verified1 = verifier.verify(signed1);
  if (verified1.valid && verified1.message.type === 'RESULT') {
    console.log('   ✅ PASSED - Message verified correctly');
    passed++;
  } else {
    console.log(`   ❌ FAILED - ${verified1.error}`);
    failed++;
  }

  // Test 2: Detect tampered message
  console.log('\n✅ Test 2: Detect tampered message');
  const tampered = JSON.parse(JSON.stringify(signed1));
  tampered.message.step_id = 'step_999'; // Tamper

  const verified2 = verifier.verify(tampered);
  if (!verified2.valid && verified2.error.includes('Invalid signature')) {
    console.log('   ✅ PASSED - Tampering detected');
    passed++;
  } else {
    console.log('   ❌ FAILED - Tampering not detected');
    failed++;
  }

  // Test 3: Old message rejection
  console.log('\n✅ Test 3: Old message rejection');
  const oldMessage = {
    type: 'RESULT',
    step_id: 'step_002',
    timestamp: Math.floor(Date.now() / 1000) - 400 // 400 seconds ago
  };

  // Sign with old timestamp
  const crypto = require('crypto');
  const messageJson = JSON.stringify(oldMessage, Object.keys(oldMessage).sort());
  const oldSignature = crypto
    .createHmac('sha256', process.env.HMAC_MASTER_SECRET)
    .update(messageJson)
    .digest('hex');

  const oldSigned = {
    message: oldMessage,
    signature: oldSignature
  };

  const verified3 = verifier.verify(oldSigned);
  if (!verified3.valid && verified3.error.includes('too old')) {
    console.log('   ✅ PASSED - Old message rejected');
    passed++;
  } else {
    console.log('   ❌ FAILED - Old message not rejected');
    failed++;
  }

  // Test 4: WebSocket wrapping
  console.log('\n✅ Test 4: WebSocket message wrapping');
  const message4 = {
    type: 'RESULT',
    step_id: 'step_003',
    success: true
  };

  const wrapped = verifier.wrapWebSocketMessage(message4);
  const parsedWrapped = JSON.parse(wrapped);

  if (parsedWrapped.signature && parsedWrapped.message) {
    console.log('   ✅ PASSED - Message wrapped correctly');
    passed++;
  } else {
    console.log('   ❌ FAILED - Wrapping failed');
    failed++;
  }

  // Test 5: WebSocket unwrapping
  console.log('\n✅ Test 5: WebSocket message unwrapping');
  const unwrapped = verifier.unwrapWebSocketMessage(wrapped);

  if (unwrapped.valid && unwrapped.message.type === 'RESULT') {
    console.log('   ✅ PASSED - Message unwrapped correctly');
    passed++;
  } else {
    console.log(`   ❌ FAILED - ${unwrapped.error}`);
    failed++;
  }

  // Test 6: Invalid JSON handling
  console.log('\n✅ Test 6: Invalid JSON handling');
  const invalidJson = '{invalid json';
  const verified6 = verifier.unwrapWebSocketMessage(invalidJson);

  if (!verified6.valid && verified6.error.includes('Invalid JSON')) {
    console.log('   ✅ PASSED - Invalid JSON detected');
    passed++;
  } else {
    console.log('   ❌ FAILED - Invalid JSON not detected');
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (failed === 0) {
    console.log('🎉 All HMAC Verifier tests PASSED!');
  } else {
    console.log(`❌ ${failed} test(s) failed`);
  }
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('\n✅ Frontend HMAC verification ready!');

  return failed === 0;
}

// Run tests
const success = testHMACVerifier();
process.exit(success ? 0 : 1);
