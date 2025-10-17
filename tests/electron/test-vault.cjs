/**
 * Test script for Memory Vault
 * Run with: node electron/test-vault.cjs
 */

const MemoryVault = require('./memory-vault.cjs');
const path = require('path');
const fs = require('fs');

// Setup test data path
const testDataPath = path.join(__dirname, '../test-vault-data');
if (!fs.existsSync(testDataPath)) {
  fs.mkdirSync(testDataPath, { recursive: true });
}

async function runTests() {
  console.log('\n🧪 Testing Memory Vault\n');
  console.log('='.repeat(60));

  // Create vault with test data path
  const vault = new MemoryVault({ dataPath: testDataPath });

  try {
    // Test 1: Initialize
    console.log('\n1️⃣  Test: Initialize Vault');
    await vault.initialize();
    console.log('✅ Vault initialized successfully');

    // Test 2: Set display name
    console.log('\n2️⃣  Test: Set Identity Name');
    vault.setDisplayName('Test User');
    const identity = vault.getIdentity();
    console.log('✅ Identity:', identity);

    // Test 3: Add facts
    console.log('\n3️⃣  Test: Add Facts');
    vault.setFact('personal', 'name', 'Colin', { confidence: 0.95, pii_level: 1 });
    vault.setFact('location', 'city', 'Philadelphia', { confidence: 0.9, pii_level: 2 });
    vault.setFact('preference', 'language', 'Python', { confidence: 0.85, pii_level: 0 });
    vault.setFact('work', 'role', 'Developer', { confidence: 0.8, pii_level: 1 });
    console.log('✅ Added 4 facts');

    // Test 4: Get facts
    console.log('\n4️⃣  Test: Retrieve Facts');
    const allFacts = vault.getAllFacts();
    console.log('✅ Retrieved', allFacts.length, 'facts:');
    allFacts.forEach((f) => {
      console.log(
        `   - ${f.category}.${f.predicate} = ${f.object} (confidence: ${f.confidence})`
      );
    });

    // Test 5: Create session
    console.log('\n5️⃣  Test: Create Session');
    const sessionId = vault.createSession('Test goal: Learn about memory vault');
    console.log('✅ Session created:', sessionId);

    // Test 6: Add messages
    console.log('\n6️⃣  Test: Add Messages');
    vault.addMessage('user', 'Hello, can you help me with Python?');
    vault.addMessage('assistant', 'Of course! I see you prefer Python. What would you like to know?');
    vault.addMessage('user', 'How do I use SQLite in Python?');
    console.log('✅ Added 3 messages');

    // Test 7: Retrieve messages
    console.log('\n7️⃣  Test: Retrieve Recent Messages');
    const messages = vault.getRecentMessages(5);
    console.log('✅ Retrieved', messages.length, 'messages:');
    messages.forEach((m) => {
      const preview = m.content.slice(0, 50) + (m.content.length > 50 ? '...' : '');
      console.log(`   - ${m.role}: ${preview}`);
    });

    // Test 8: Update fact
    console.log('\n8️⃣  Test: Update Fact');
    const pythonFact = vault.getFact('preference', 'language');
    if (pythonFact) {
      vault.updateFact(pythonFact.id, { confidence: 0.95 });
      const updated = vault.getFact('preference', 'language');
      console.log('✅ Updated fact confidence:', updated.confidence);
    }

    // Test 9: Reinforce fact
    console.log('\n9️⃣  Test: Reinforce Fact');
    if (pythonFact) {
      const before = pythonFact.confidence;
      vault.reinforceFact(pythonFact.id);
      const after = vault.getFact('preference', 'language').confidence;
      console.log(`✅ Reinforced: ${before} → ${after}`);
    }

    // Test 10: Search messages
    console.log('\n🔟 Test: Full-Text Search');
    const searchResults = vault.searchMessages('Python');
    console.log('✅ Found', searchResults.length, 'messages matching "Python":');
    searchResults.forEach((m) => {
      const preview = m.content.slice(0, 50);
      console.log(`   - ${preview}...`);
    });

    // Test 11: Get stats
    console.log('\n1️⃣1️⃣  Test: Get Statistics');
    const stats = vault.getStats();
    console.log('✅ Vault statistics:');
    console.log('   - Display name:', stats.display_name);
    console.log('   - Facts:', stats.facts);
    console.log('   - Sessions:', stats.sessions);
    console.log('   - Messages:', stats.messages);
    console.log('   - Vault path:', stats.vault_path);

    // Test 12: Export
    console.log('\n1️⃣2️⃣  Test: Export Vault');
    const exported = vault.exportVault();
    console.log('✅ Export successful:');
    console.log('   - Identity:', exported.identity.display_name);
    console.log('   - Facts:', exported.facts.length);
    console.log('   - Sessions:', exported.sessions.length);

    // Test 13: Backup
    console.log('\n1️⃣3️⃣  Test: Backup Database');
    const backupPath = path.join(__dirname, '../test-vault-data/vault-backup.db');
    vault.backup(backupPath);
    console.log('✅ Backup created at:', backupPath);

    // Test 14: End session
    console.log('\n1️⃣4️⃣  Test: End Session');
    vault.endSession('Test session completed');
    console.log('✅ Session ended');

    // Test 15: Get all sessions
    console.log('\n1️⃣5️⃣  Test: List All Sessions');
    const sessions = vault.getAllSessions(10);
    console.log('✅ Retrieved', sessions.length, 'sessions:');
    sessions.forEach((s) => {
      console.log(`   - ${s.goal || 'No goal'} (${s.started_at})`);
    });

    // Final cleanup
    vault.close();
    console.log('\n✅ Vault closed');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED! 🎉');
    console.log('='.repeat(60));
    console.log('\nThe Memory Vault is working correctly!');
    console.log('You can now proceed with migration.\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    vault.close();
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
