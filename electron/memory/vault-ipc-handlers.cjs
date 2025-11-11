/**
 * Vault IPC Handlers
 * Exposes Memory Vault methods to renderer process via IPC
 */

const { ipcMain } = require('electron');

class VaultIPCHandlers {
  constructor(vault) {
    this.vault = vault;
  }

  /**
   * Register all IPC handlers
   */
  register() {
    // Stats
    ipcMain.handle('vault:getStats', async () => {
      return this.vault.getStats();
    });

    // Identity
    ipcMain.handle('vault:getIdentity', async () => {
      return this.vault.getIdentity();
    });

    ipcMain.handle('vault:setDisplayName', async (event, name) => {
      return this.vault.setDisplayName(name);
    });

    // Sessions
    ipcMain.handle('vault:createSession', async (event, goal) => {
      return this.vault.createSession(goal);
    });

    ipcMain.handle('vault:getCurrentSession', async () => {
      return this.vault.getCurrentSession();
    });

    ipcMain.handle('vault:endSession', async (event, summary) => {
      return this.vault.endSession(summary);
    });

    ipcMain.handle('vault:getAllSessions', async (event, limit) => {
      return this.vault.getAllSessions(limit);
    });

    // Messages
    ipcMain.handle('vault:addMessage', async (event, role, content, sessionId) => {
      return this.vault.addMessage(role, content, sessionId);
    });

    ipcMain.handle('vault:getRecentMessages', async (event, count, sessionId) => {
      return this.vault.getRecentMessages(count, sessionId);
    });

    ipcMain.handle('vault:getAllMessagesForSession', async (event, sessionId) => {
      return this.vault.getAllMessagesForSession(sessionId);
    });

    // Facts
    ipcMain.handle('vault:setFact', async (event, category, predicate, object, options) => {
      return this.vault.setFact(category, predicate, object, options);
    });

    ipcMain.handle('vault:getFact', async (event, category, predicate) => {
      return this.vault.getFact(category, predicate);
    });

    ipcMain.handle('vault:getAllFacts', async (event, category) => {
      return this.vault.getAllFacts(category);
    });

    ipcMain.handle('vault:updateFact', async (event, id, updates) => {
      return this.vault.updateFact(id, updates);
    });

    ipcMain.handle('vault:deleteFact', async (event, id) => {
      return this.vault.deleteFact(id);
    });

    ipcMain.handle('vault:reinforceFact', async (event, id) => {
      return this.vault.reinforceFact(id);
    });

    // Search
    ipcMain.handle('vault:searchMessages', async (event, query, limit) => {
      return this.vault.searchMessages(query, limit);
    });

    ipcMain.handle('vault:searchFacts', async (event, query) => {
      return this.vault.searchFacts(query);
    });

    // Export/Backup
    ipcMain.handle('vault:export', async () => {
      return this.vault.exportVault();
    });

    ipcMain.handle('vault:backup', async (event, backupPath) => {
      return this.vault.backup(backupPath);
    });

    console.log('✓ Vault IPC handlers registered');
  }

  /**
   * Unregister all handlers (for cleanup)
   */
  unregister() {
    const handlers = [
      'vault:getStats',
      'vault:getIdentity',
      'vault:setDisplayName',
      'vault:createSession',
      'vault:getCurrentSession',
      'vault:endSession',
      'vault:getAllSessions',
      'vault:addMessage',
      'vault:getRecentMessages',
      'vault:getAllMessagesForSession',
      'vault:setFact',
      'vault:getFact',
      'vault:getAllFacts',
      'vault:updateFact',
      'vault:deleteFact',
      'vault:reinforceFact',
      'vault:searchMessages',
      'vault:searchFacts',
      'vault:export',
      'vault:backup',
    ];

    handlers.forEach((handler) => {
      ipcMain.removeHandler(handler);
    });
  }
}

module.exports = VaultIPCHandlers;
