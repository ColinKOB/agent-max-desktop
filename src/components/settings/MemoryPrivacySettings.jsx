/**
 * Memory Privacy Settings Component
 * 
 * Provides user controls for Memory V3 privacy:
 * - Toggle memory features on/off
 * - Clear all memories
 * - View memory audit
 */

import { useState } from 'react';
import { Shield, Trash2, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { createLogger } from '../../services/logger';
import './MemoryPrivacySettings.css';

const logger = createLogger('MemoryPrivacySettings');

const API_BASE = import.meta.env.VITE_API_URL || 'https://agentmax-production.up.railway.app';

export default function MemoryPrivacySettings({ userId }) {
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [auditData, setAuditData] = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  /**
   * Toggle memory opt-out
   */
  const handleToggleMemory = async () => {
    const newState = !memoryEnabled;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      };

      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(`${API_BASE}/api/memory/privacy/opt-out`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          opt_out: !newState, // opt_out is opposite of enabled
          reason: 'user_preference',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update: ${response.status}`);
      }

      const data = await response.json();
      setMemoryEnabled(!data.opt_out);

      toast.success(
        newState
          ? '✅ Memory features enabled'
          : '🔒 Memory features disabled'
      );

      logger.info('Memory toggle updated', { enabled: newState });
    } catch (error) {
      toast.error('Failed to update memory settings');
      logger.error('Toggle failed', { error: error.message });
    }
  };

  /**
   * Clear all memories (requires confirmation)
   */
  const handleClearMemories = async () => {
    setIsClearing(true);

    try {
      const headers = {
        'X-User-Id': userId,
      };

      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(
        `${API_BASE}/api/memory/privacy/clear?confirm=true`,
        {
          method: 'DELETE',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to clear: ${response.status}`);
      }

      const data = await response.json();

      toast.success(
        `🗑️ Deleted ${data.memories_deleted} ${
          data.memories_deleted === 1 ? 'memory' : 'memories'
        }`
      );

      logger.info('Memories cleared', {
        count: data.memories_deleted,
      });

      setShowClearConfirm(false);
    } catch (error) {
      toast.error('Failed to clear memories');
      logger.error('Clear failed', { error: error.message });
    } finally {
      setIsClearing(false);
    }
  };

  /**
   * Load audit data
   */
  const handleLoadAudit = async () => {
    try {
      const headers = {
        'X-User-Id': userId,
      };

      const apiKey = import.meta.env.VITE_API_KEY;
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      }

      const response = await fetch(`${API_BASE}/api/memory/privacy/audit`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to load audit: ${response.status}`);
      }

      const data = await response.json();
      setAuditData(data);
      setShowAudit(true);

      logger.info('Audit loaded');
    } catch (error) {
      toast.error('Failed to load audit');
      logger.error('Audit failed', { error: error.message });
    }
  };

  return (
    <div className="memory-privacy-settings">
      <div className="settings-section">
        <div className="section-header">
          <Shield size={20} />
          <h3>Memory Privacy</h3>
        </div>

        {/* Memory Toggle */}
        <div className="setting-row">
          <div className="setting-info">
            <h4>Memory Features</h4>
            <p>Allow Agent Max to remember our conversations</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={memoryEnabled}
              onChange={handleToggleMemory}
            />
            <span className="slider"></span>
          </label>
        </div>

        {/* View Audit */}
        <div className="setting-row">
          <div className="setting-info">
            <h4>Memory Audit</h4>
            <p>View what data is stored in your memories</p>
          </div>
          <button className="btn-secondary" onClick={handleLoadAudit}>
            <Eye size={16} />
            View Audit
          </button>
        </div>

        {/* Clear Memories */}
        <div className="setting-row">
          <div className="setting-info">
            <h4>Clear All Memories</h4>
            <p>Permanently delete all stored conversation memories</p>
          </div>
          <button
            className="btn-danger"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 size={16} />
            Clear Memories
          </button>
        </div>
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <AlertTriangle size={32} className="warning-icon" />
              <h3>Clear All Memories?</h3>
            </div>
            <p className="modal-message">
              This will permanently delete all your conversation memories. This
              action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
              >
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={handleClearMemories}
                disabled={isClearing}
              >
                {isClearing ? 'Clearing...' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {showAudit && auditData && (
        <div className="modal-overlay" onClick={() => setShowAudit(false)}>
          <div className="modal-content audit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <Eye size={24} />
              <h3>Memory Audit</h3>
            </div>
            <div className="audit-content">
              <pre>{JSON.stringify(auditData, null, 2)}</pre>
            </div>
            <div className="modal-actions">
              <button className="btn-primary" onClick={() => setShowAudit(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
