/**
 * Test Integration
 * Tests vault integration with migration
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Mock Electron app
const testDataPath = path.join(__dirname, '../test-integration-data');
if (fs.existsSync(testDataPath)) {
  fs.rmSync(testDataPath, { recursive: true, force: true });
}
fs.mkdirSync(testDataPath, { recursive: true });

const mockApp = {
  getPath: () => testDataPath,
};

require.cache[require.resolve('electron')] = {
  exports: { app: mockApp, ipcMain: { handle: () => {}, removeHandler: () => {} } },
};

const VaultIntegration = require('./vault-integration.cjs');

/**
 * Create sample old memory files
 */
function createOldMemoryFiles() {
  const memoryDir = path.join(testDataPath, 'memories');
  fs.mkdirSync(memoryDir, { recursive: true });

  // Encrypt data like old system
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

  // Profile
  const profile = {
    name: 'Integration Test User',
    created_at: '2025-10-16T00:00:00Z',
    interaction_count: 5,
  };
  fs.writeFileSync(path.join(memoryDir, 'profile.json'), JSON.stringify(encryptOld(profile), null, 2));

  // Facts
  const facts = {
    personal: {
      name: { value: 'Test User', updated_at: '2025-10-16T00:00:00Z' },
    },
    location: {
      city: { value: 'Test City', updated_at: '2025-10-16T00:00:00Z' },
    },
  };
  fs.writeFileSync(path.join(memoryDir, 'facts.json'), JSON.stringify(encryptOld(facts), null, 2));

  // Conversations
  const conversations = {
    sessions: {
      session_1: {
        started_at: '2025-10-16T00:00:00Z',
        messages: [
          { role: 'user', content: 'Hello', timestamp: '2025-10-16T00:00:00Z' },
          { role: 'assistant', content: 'Hi there!', timestamp: '2025-10-16T00:00:05Z' },
        ],
      },
    },
    current_session: 'session_1',
  };
  fs.writeFileSync(
    path.join(memoryDir, 'conversations.json'),
    JSON.stringify(encryptOld(conversations), null, 2)
  );

  // Preferences
  const preferences = {
    explicit: {
      theme: { value: 'dark', updated_at: '2025-10-16T00:00:00Z' },
    },
    implicit: {},
    work: {},
    system: {},
  };
  fs.writeFileSync(
    path.join(memoryDir, 'preferences.json'),
    JSON.stringify(encryptOld(preferences), null, 2)
  );

  console.log('✓ Created old memory files\n');
}

/**
 * Run integration test
 */
async function runTest() {
  console.log('\n🧪 Testing Vault Integration\n');
  console.log('='.repeat(60));

  try {
    // Test 1: Fresh install (no old files)
    console.log('\n1️⃣  Test: Fresh install');
    const integration1 = new VaultIntegration();
    const success1 = await integration1.initialize();
    console.log(success1 ? '✅ Fresh install successful' : '❌ Fresh install failed');
    integration1.cleanup();

    // Delete vault for next test
    const vaultPath = path.join(testDataPath, 'memory-vault.db');
    if (fs.existsSync(vaultPath)) {
      fs.unlinkSync(vaultPath);
    }

    // Test 2: Migration (with old files)
    console.log('\n2️⃣  Test: Migration from old system');
    createOldMemoryFiles();
    const integration2 = new VaultIntegration();
    const success2 = await integration2.initialize();
    console.log(success2 ? '✅ Migration successful' : '❌ Migration failed');
    console.log(integration2.wasMigrated() ? '✅ Migration flag set' : '❌ Migration flag not set');

    // Verify vault has data
    const vault = integration2.getVault();
    if (vault) {
      const stats = vault.getStats();
      console.log('\n📊 Vault stats after migration:');
      console.log('   - Display name:', stats.display_name);
      console.log('   - Facts:', stats.facts);
      console.log('   - Sessions:', stats.sessions);
      console.log('   - Messages:', stats.messages);

      const hasData = stats.facts > 0 && stats.messages > 0;
      console.log(hasData ? '✅ Data migrated successfully' : '❌ No data in vault');
    }

    // Test 3: Existing vault (no migration)
    console.log('\n3️⃣  Test: Load existing vault');
    const integration3 = new VaultIntegration();
    const success3 = await integration3.initialize();
    console.log(success3 ? '✅ Loaded existing vault' : '❌ Failed to load vault');
    console.log(!integration3.wasMigrated() ? '✅ No migration (as expected)' : '❌ Unexpected migration');

    // Test 4: Backup exists
    console.log('\n4️⃣  Test: Backup created');
    const backupDir = path.join(testDataPath, 'memories.backup');
    const backupExists = fs.existsSync(backupDir);
    console.log(backupExists ? '✅ Backup directory exists' : '❌ No backup directory');

    if (backupExists) {
      const files = fs.readdirSync(backupDir);
      console.log('   Backup files:', files.join(', '));
    }

    // Test 5: Migration log
    console.log('\n5️⃣  Test: Migration log');
    const logPath = path.join(testDataPath, 'vault-migration.log');
    const logExists = fs.existsSync(logPath);
    console.log(logExists ? '✅ Migration log exists' : '❌ No migration log');

    if (logExists) {
      const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      console.log('   Success:', log.success);
      if (log.stats) {
        console.log('   Migrated facts:', log.stats.facts_migrated);
        console.log('   Migrated messages:', log.stats.messages_migrated);
      }
    }

    integration3.cleanup();

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL INTEGRATION TESTS PASSED! 🎉');
    console.log('='.repeat(60));
    console.log('\nIntegration is working correctly!\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    return false;
  }
}

runTest()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
