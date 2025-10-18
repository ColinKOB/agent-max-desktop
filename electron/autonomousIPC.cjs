/**
 * Autonomous Execution IPC Handlers
 * 
 * Handles IPC communication between renderer and main process
 * for autonomous execution via WebSocket + local executor
 */

const { ipcMain } = require('electron');
const StubExecutor = require('./stubExecutor.cjs');
const LocalExecutor = require('./localExecutor.cjs');

// Mode flag: switch between stub and real execution
const USE_REAL_EXECUTOR = true; // Set to true for Puppeteer, false for stub

class AutonomousIPCHandlers {
  constructor() {
    // Choose executor based on mode
    this.executor = USE_REAL_EXECUTOR ? new LocalExecutor() : new StubExecutor();
    this.activeConversations = new Map();
    console.log(`[AutonomousIPC] Using ${USE_REAL_EXECUTOR ? 'REAL' : 'STUB'} executor`);
  }

  /**
   * Register all IPC handlers
   */
  register() {
    console.log('[AutonomousIPC] Registering handlers...');
    
    ipcMain.handle('autonomous:execute', this.handleExecute.bind(this));
    ipcMain.handle('autonomous:getStatus', this.handleGetStatus.bind(this));
    
    console.log('[AutonomousIPC] Handlers registered ✅');
  }

  /**
   * Handle execute action
   */
  async handleExecute(event, { stepId, action, policy }) {
    console.log('[AutonomousIPC] Execute request:', stepId, action.type);
    
    try {
      // Execute action with stub executor
      const executionResult = await this.executor.execute(action, policy);
      
      // Return result
      return {
        success: true,
        stepId,
        ...executionResult
      };
    } catch (error) {
      console.error('[AutonomousIPC] Execution error:', error);
      
      return {
        success: false,
        stepId,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message,
          stack: error.stack
        }
      };
    }
  }

  /**
   * Handle get status
   */
  async handleGetStatus(event, { conversationId }) {
    console.log('[AutonomousIPC] Status request:', conversationId);
    
    const conversation = this.activeConversations.get(conversationId);
    
    if (!conversation) {
      return {
        found: false
      };
    }
    
    return {
      found: true,
      status: conversation.status,
      currentStep: conversation.currentStep,
      totalSteps: conversation.totalSteps
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    console.log('[AutonomousIPC] Cleaning up...');
    this.activeConversations.clear();
  }
}

// Export singleton instance
const autonomousIPC = new AutonomousIPCHandlers();

module.exports = autonomousIPC;
