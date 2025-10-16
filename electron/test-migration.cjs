/**
 * Test script for migration
 * Creates sample JSON data and tests migration to vault
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const VaultMigration = require('./migrate-to-vault.cjs');

// Setup test directory
const testDataPath = path.join(__dirname, '../test-migration-data');
const memoryDir = path.join(testDataPath, 'memories');

// Clean up previous test
if (fs.existsSync(testDataPath)) {
  fs.rmSync(testDataPath, { recursive: true, force: true });
}
fs.mkdirSync(memoryDir, { recursive: true });

/**
 * Encrypt data like old system did
 */
function encryptOld(data) {
  const machineId = require('node-machine-id').machineIdSync();
  const key = crypto.createHash('sha256').update(`${machineId}agent-max-desktop`).digest();
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    iv: iv.toString('hex'),
    data: encrypted,
  };
}

/**
 * Create sample JSON files
 */
function createSampleData() {
  console.log('📝 Creating sample JSON data...\n');

  // Profile
  const profile = {
    name: 'Test User',
    created_at: '2025-01-01T00:00:00Z',
    interaction_count: 10,
    last_interaction: '2025-10-16T12:00:00Z',
    preferences: {},
  };
  fs.writeFileSync(
    path.join(memoryDir, 'profile.json'),
    JSON.stringify(encryptOld(profile), null, 2)
  );
  console.log('✓ profile.json');

  // Facts
  const facts = {
    personal: {
      name: { value: 'Colin', updated_at: '2025-10-01T10:00:00Z' },
      description: { value: 'developer', updated_at: '2025-10-01T10:00:00Z' },
    },
    location: {
      city: { value: 'Philadelphia', updated_at: '2025-10-01T10:00:00Z' },
    },
    preference: {
      language: { value: 'Python', updated_at: '2025-10-01T10:00:00Z' },
      editor: { value: 'VSCode', updated_at: '2025-10-01T10:00:00Z' },
    },
    work: {
      role: { value: 'Software Engineer', updated_at: '2025-10-01T10:00:00Z' },
    },
  };
  fs.writeFileSync(
    path.join(memoryDir, 'facts.json'),
    JSON.stringify(encryptOld(facts), null, 2)
  );
  console.log('✓ facts.json (6 facts)');

  // Conversations
  const conversations = {
    sessions: {
      session_1: {
        started_at: '2025-10-15T10:00:00Z',
        goal: 'Learn about Python',
        messages: [
          { role: 'user', content: 'Can you help me with Python?', timestamp: '2025-10-15T10:00:00Z' },
          { role: 'assistant', content: 'Of course! What would you like to know?', timestamp: '2025-10-15T10:00:05Z' },
          { role: 'user', content: 'How do I use list comprehensions?', timestamp: '2025-10-15T10:01:00Z' },
          { role: 'assistant', content: 'List comprehensions are a concise way to create lists...', timestamp: '2025-10-15T10:01:10Z' },
        ],
      },
      session_2: {
        started_at: '2025-10-16T09:00:00Z',
        goal: 'Weather check',
        messages: [
          { role: 'user', content: 'What\'s the weather in Philadelphia?', timestamp: '2025-10-16T09:00:00Z' },
          { role: 'assistant', content: 'Let me check for you...', timestamp: '2025-10-16T09:00:05Z' },
        ],
      },
    },
    current_session: 'session_2',
  };
  fs.writeFileSync(
    path.join(memoryDir, 'conversations.json'),
    JSON.stringify(encryptOld(conversations), null, 2)
  );
  console.log('✓ conversations.json (2 sessions, 6 messages)');

  // Preferences
  const preferences = {
    explicit: {
      theme: { value: 'dark', updated_at: '2025-10-01T10:00:00Z' },
      notifications: { value: true, updated_at: '2025-10-01T10:00:00Z' },
    },
    implicit: {
      prefers_python: { value: true, updated_at: '2025-10-15T10:00:00Z' },
    },
    work: {},
    system: {},
  };
  fs.writeFileSync(
    path.join(memoryDir, 'preferences.json'),
    JSON.stringify(encryptOld(preferences), null, 2)
  );
  console.log('✓ preferences.json (3 preferences)');

  console.log('\n✅ Sample data created\n');
}

/**
 * Run migration test
 */
async function runMigrationTest() {
  console.log('🧪 Testing Migration\n');
  console.log('='.repeat(60));

  try {
    // Create sample data
    createSampleData();

    // Run migration
    const migration = new VaultMigration(testDataPath);
    const result = await migration.migrate();

    if (result.success) {
      console.log('\n🎉 Migration test PASSED!\n');
      console.log('Final stats:', result.stats);
      
      // Verify backup exists
      const backupDir = path.join(testDataPath, 'memories.backup');
      if (fs.existsSync(backupDir)) {
        console.log('\n✅ Backup directory created:', backupDir);
        const files = fs.readdirSync(backupDir);
        console.log('   Backup files:', files.join(', '));
      }
      
      // Verify vault exists
      const vaultPath = path.join(testDataPath, 'memory-vault.db');
      if (fs.existsSync(vaultPath)) {
        const stats = fs.statSync(vaultPath);
        console.log('\n✅ Vault database created:', vaultPath);
        console.log('   Size:', (stats.size / 1024).toFixed(2), 'KB');
      }
      
      return true;
    } else {
      console.error('\n❌ Migration test FAILED:', result.error);
      return false;
    }
  } catch (error) {
    console.error('\n❌ Migration test FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Run test
runMigrationTest()
  .then((success) => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('✅ All migration tests passed!');
      console.log('='.repeat(60));
      console.log('\nTest data location:', testDataPath);
      console.log('You can inspect the vault with SQLite tools.\n');
      process.exit(0);
    } else {
      console.log('❌ Migration tests failed');
      console.log('='.repeat(60));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
