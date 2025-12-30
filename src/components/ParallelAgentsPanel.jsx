/**
 * ParallelAgentsPanel - Worktree-style display of parallel web agents
 * Shows multiple agents running simultaneously with their status
 */

import React, { useState, useEffect } from 'react';
import { Globe, Loader2, Check, X, ChevronRight, GitBranch } from 'lucide-react';

const statusColors = {
  pending: 'text-gray-400',
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

const statusIcons = {
  pending: <ChevronRight className="w-3 h-3" />,
  running: <Loader2 className="w-3 h-3 animate-spin" />,
  completed: <Check className="w-3 h-3" />,
  failed: <X className="w-3 h-3" />,
};

export function ParallelAgentsPanel({ agents, onClose }) {
  if (!agents || agents.length === 0) return null;

  const runningCount = agents.filter((a) => a.status === 'running').length;
  const completedCount = agents.filter((a) => a.status === 'completed').length;

  return (
    <div
      className="parallel-agents-panel"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: '8px',
        background: 'rgba(30, 30, 35, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '12px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <GitBranch className="w-4 h-4 text-blue-400" />
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.9)' }}>
          Parallel Agents
        </span>
        <span
          style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.5)',
            marginLeft: 'auto',
          }}
        >
          {runningCount} running / {completedCount} done
        </span>
      </div>

      {/* Agent Tree */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {agents.map((agent, index) => (
          <div
            key={agent.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '6px 8px',
              background:
                agent.status === 'running'
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(255, 255, 255, 0.03)',
              borderRadius: '6px',
              border:
                agent.status === 'running'
                  ? '1px solid rgba(59, 130, 246, 0.3)'
                  : '1px solid transparent',
            }}
          >
            {/* Tree connector line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: '2px',
                  height: index === 0 ? '8px' : '16px',
                  background:
                    index === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                }}
              />
              <div
                className={statusColors[agent.status]}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {statusIcons[agent.status]}
              </div>
              <div
                style={{
                  width: '2px',
                  height: index === agents.length - 1 ? '0' : '8px',
                  background:
                    index === agents.length - 1
                      ? 'transparent'
                      : 'rgba(255, 255, 255, 0.2)',
                }}
              />
            </div>

            {/* Agent info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '2px',
                }}
              >
                <Globe className="w-3 h-3 text-blue-400" style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'rgba(255, 255, 255, 0.9)',
                    textTransform: 'capitalize',
                  }}
                >
                  {agent.id}
                </span>
                {agent.step !== undefined && agent.status === 'running' && (
                  <span
                    style={{
                      fontSize: '9px',
                      color: 'rgba(255, 255, 255, 0.4)',
                      marginLeft: 'auto',
                    }}
                  >
                    step {agent.step}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={agent.goal}
              >
                {agent.goal || 'Working...'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ParallelAgentsPanel;
