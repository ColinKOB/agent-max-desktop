/**
 * WorkspaceActivityLog - Activity Log Viewer for Max's Monitor
 *
 * Displays a log of all AI workspace actions so users can review
 * what Max did during browsing sessions.
 */

import React, { useEffect, useState, useCallback } from 'react';
import './WorkspaceActivityLog.css';

interface ActivityEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  action: string;
  parameters: Record<string, unknown>;
  result: 'success' | 'error';
  error: string | null;
  pageTitle: string;
  pageUrl: string;
}

interface Session {
  sessionId: string;
  startTime: string;
  endTime: string;
  actionCount: number;
}

interface WorkspaceActivityLogProps {
  /** Maximum entries to display */
  maxEntries?: number;
  /** Whether to auto-refresh */
  autoRefresh?: boolean;
  /** Refresh interval in ms */
  refreshInterval?: number;
}

// Action type display names and icons
const ACTION_DISPLAY: Record<string, { icon: string; label: string; color: string }> = {
  session_start: { icon: '🚀', label: 'Session Started', color: '#22c55e' },
  session_end: { icon: '🏁', label: 'Session Ended', color: '#6b7280' },
  navigate: { icon: '🌐', label: 'Navigate', color: '#3b82f6' },
  search: { icon: '🔍', label: 'Search', color: '#8b5cf6' },
  click: { icon: '👆', label: 'Click', color: '#f59e0b' },
  click_element: { icon: '👆', label: 'Click Element', color: '#f59e0b' },
  type: { icon: '⌨️', label: 'Type', color: '#ec4899' },
  scroll: { icon: '📜', label: 'Scroll', color: '#06b6d4' },
  back: { icon: '⬅️', label: 'Back', color: '#64748b' },
  forward: { icon: '➡️', label: 'Forward', color: '#64748b' },
  minimize: { icon: '➖', label: 'Minimized', color: '#6b7280' },
  restore: { icon: '🔲', label: 'Restored', color: '#22c55e' },
};

export function WorkspaceActivityLog({
  maxEntries = 100,
  autoRefresh = true,
  refreshInterval = 5000,
}: WorkspaceActivityLogProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch activity log
  const fetchActivityLog = useCallback(async () => {
    try {
      // @ts-ignore - workspace is exposed via preload
      const result = await window.workspace?.getActivityLog({
        limit: maxEntries,
        sessionId: selectedSession,
        actionType: filterAction,
      });

      if (result?.success) {
        setEntries(result.log || []);
        setError(null);
      } else {
        setError('Failed to load activity log');
      }
    } catch (err) {
      setError('Failed to connect to workspace');
      console.error('[ActivityLog] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [maxEntries, selectedSession, filterAction]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      // @ts-ignore - workspace is exposed via preload
      const result = await window.workspace?.getSessions();

      if (result?.success) {
        setSessions(result.sessions || []);
      }
    } catch (err) {
      console.error('[ActivityLog] Sessions fetch error:', err);
    }
  }, []);

  // Clear activity log
  const handleClearLog = useCallback(async () => {
    if (!confirm('Are you sure you want to clear all activity history?')) {
      return;
    }

    try {
      // @ts-ignore - workspace is exposed via preload
      await window.workspace?.clearActivityLog();
      setEntries([]);
      setSessions([]);
    } catch (err) {
      console.error('[ActivityLog] Clear error:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchActivityLog();
    fetchSessions();
  }, [fetchActivityLog, fetchSessions]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchActivityLog();
      fetchSessions();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchActivityLog, fetchSessions]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format date
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get action display info
  const getActionDisplay = (action: string) => {
    return ACTION_DISPLAY[action] || { icon: '📌', label: action, color: '#6b7280' };
  };

  // Format parameters for display
  const formatParams = (action: string, params: Record<string, unknown>): string => {
    switch (action) {
      case 'navigate':
        return params.url ? String(params.url).substring(0, 50) + '...' : '';
      case 'search':
        return params.query ? `"${params.query}"` : '';
      case 'click_element':
        return params.selector ? String(params.selector).substring(0, 40) : '';
      case 'type':
        return params.textPreview ? `"${params.textPreview}"` : '';
      case 'scroll':
        return params.direction ? `${params.direction}` : '';
      default:
        return '';
    }
  };

  // Get unique action types for filter
  const actionTypes = Array.from(new Set(entries.map(e => e.action)));

  if (isLoading) {
    return (
      <div className="activity-log-loading">
        <div className="activity-log-spinner" />
        <span>Loading activity log...</span>
      </div>
    );
  }

  return (
    <div className="activity-log-container">
      {/* Header */}
      <div className="activity-log-header">
        <div className="activity-log-title">
          <svg className="activity-log-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e8853b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8V4H8"/><rect x="5" y="8" width="14" height="12" rx="2"/><path d="M9 14h0"/><path d="M15 14h0"/>
          </svg>
          <h3>Max's Activity</h3>
          <span className="activity-log-count">{entries.length} actions</span>
        </div>
        <div className="activity-log-actions">
          <button
            className="activity-log-btn activity-log-refresh"
            onClick={fetchActivityLog}
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
          <button
            className="activity-log-btn activity-log-clear"
            onClick={handleClearLog}
            title="Clear History"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="activity-log-filters">
        <select
          className="activity-log-filter"
          value={selectedSession || ''}
          onChange={(e) => setSelectedSession(e.target.value || null)}
        >
          <option value="">All Sessions</option>
          {sessions.map((session) => (
            <option key={session.sessionId} value={session.sessionId}>
              {formatDate(session.startTime)} - {session.actionCount} actions
            </option>
          ))}
        </select>

        <select
          className="activity-log-filter"
          value={filterAction || ''}
          onChange={(e) => setFilterAction(e.target.value || null)}
        >
          <option value="">All Actions</option>
          {actionTypes.map((action) => (
            <option key={action} value={action}>
              {getActionDisplay(action).icon} {getActionDisplay(action).label}
            </option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="activity-log-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Empty State */}
      {!error && entries.length === 0 && (
        <div className="activity-log-empty">
          <p>No activity yet</p>
        </div>
      )}

      {/* Activity List */}
      {entries.length > 0 && (
        <div className="activity-log-list">
          {entries.map((entry) => {
            const display = getActionDisplay(entry.action);
            return (
              <div
                key={entry.id}
                className={`activity-log-entry ${entry.result === 'error' ? 'error' : ''}`}
              >
                <div className="activity-entry-icon" style={{ color: display.color }}>
                  {display.icon}
                </div>
                <div className="activity-entry-content">
                  <div className="activity-entry-header">
                    <span className="activity-entry-action" style={{ color: display.color }}>
                      {display.label}
                    </span>
                    <span className="activity-entry-time">{formatTime(entry.timestamp)}</span>
                  </div>
                  <div className="activity-entry-details">
                    {formatParams(entry.action, entry.parameters) && (
                      <span className="activity-entry-params">
                        {formatParams(entry.action, entry.parameters)}
                      </span>
                    )}
                    {entry.pageUrl && (
                      <span className="activity-entry-url" title={entry.pageUrl}>
                        {entry.pageUrl.substring(0, 40)}...
                      </span>
                    )}
                  </div>
                  {entry.result === 'error' && entry.error && (
                    <div className="activity-entry-error">
                      ❌ {entry.error}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WorkspaceActivityLog;
