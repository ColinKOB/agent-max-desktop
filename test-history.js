/**
 * Test script to check conversation history storage
 * Run with: node test-history.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to conversations file
const conversationsPath = path.join(
  process.env.HOME,
  'Library/Application Support/agent-max-desktop/memories/conversations.json'
);

console.log('Testing Conversation History');
console.log('============================\n');

// Check if file exists
if (!fs.existsSync(conversationsPath)) {
  console.error('❌ Conversations file does not exist at:', conversationsPath);
  process.exit(1);
}

console.log('✅ Conversations file exists');
console.log('   Path:', conversationsPath);

// Get file stats
const stats = fs.statSync(conversationsPath);
console.log('   Size:', Math.round(stats.size / 1024), 'KB');
console.log('   Modified:', stats.mtime.toISOString());

// Read encrypted file
const encryptedData = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));

console.log('\n📦 Encrypted Data Structure:');
console.log('   Has IV:', !!encryptedData.iv);
console.log('   Has data:', !!encryptedData.data);
console.log('   IV length:', encryptedData.iv?.length || 0);
console.log('   Data length:', encryptedData.data?.length || 0);

// Try to decrypt (we need the encryption key)
try {
  // Generate same encryption key as memory manager
  const machineId = require('node-machine-id').machineIdSync();
  const encryptionKey = crypto.createHash('sha256')
    .update(machineId + 'agent-max-desktop')
    .digest();
  
  console.log('\n🔐 Decryption:');
  console.log('   Machine ID:', machineId.substring(0, 16) + '...');
  console.log('   Key generated:', encryptionKey.length, 'bytes');
  
  // Decrypt
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  const conversations = JSON.parse(decrypted);
  
  console.log('   ✅ Decryption successful!');
  console.log('\n💬 Conversations Data:');
  console.log('   Current session:', conversations.current_session || 'none');
  console.log('   Total sessions:', Object.keys(conversations.sessions || {}).length);
  
  if (conversations.sessions) {
    const sessionIds = Object.keys(conversations.sessions);
    console.log('\n📝 Sessions:');
    
    sessionIds.forEach((sessionId, index) => {
      const session = conversations.sessions[sessionId];
      console.log(`\n   ${index + 1}. Session: ${sessionId}`);
      console.log(`      Started: ${session.started_at}`);
      console.log(`      Messages: ${session.messages?.length || 0}`);
      
      if (session.messages && session.messages.length > 0) {
        const firstMsg = session.messages[0];
        const lastMsg = session.messages[session.messages.length - 1];
        console.log(`      First message: ${firstMsg.role}: "${firstMsg.content.substring(0, 50)}..."`);
        console.log(`      Last message: ${lastMsg.role}: "${lastMsg.content.substring(0, 50)}..."`);
        console.log(`      Last timestamp: ${lastMsg.timestamp}`);
      }
    });
    
    console.log('\n✅ Test Complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${sessionIds.length} conversation sessions found`);
    console.log(`   - ${sessionIds.reduce((acc, sid) => acc + (conversations.sessions[sid].messages?.length || 0), 0)} total messages`);
    
    if (sessionIds.length === 0) {
      console.log('\n⚠️  WARNING: No sessions found in conversations.json');
      console.log('   This means no conversations have been saved yet.');
      console.log('   Try having a conversation in the app first.');
    }
  } else {
    console.log('   ❌ No sessions object in conversations data');
  }
  
} catch (error) {
  console.error('\n❌ Decryption failed:', error.message);
  console.error('   Stack:', error.stack);
  process.exit(1);
}
