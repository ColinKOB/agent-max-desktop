/**
 * Plan Card Component
 * 
 * Phase 4: Accurate Lane Safeguards
 * Displays execution plan and requires user approval for side-effects.
 * 
 * Core Principles:
 * 1. Honest Progress: Show plan before execution
 * 2. User Control: Explicit approval required
 * 3. Clear Communication: Risk level, affected resources
 */
import React, { useState } from 'react';
import './PlanCard.css';

export function PlanCard({ plan, onApprove, onReject }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!plan) return null;
  
  // Extract plan details
  const {
    plan_id,
    goal,
    milestones = [],
    tasks = [],
    total_estimated_duration_ms,
    requires_approval = true,
    metadata = {}
  } = plan;
  
  // Determine risk level
  const riskLevel = metadata.risk_level || determineRiskLevel(tasks);
  const riskColor = getRiskColor(riskLevel);
  const riskIcon = getRiskIcon(riskLevel);
  
  // Calculate stats
  const totalSteps = tasks.length;
  const estimatedMinutes = total_estimated_duration_ms 
    ? Math.ceil(total_estimated_duration_ms / 60000)
    : estimateDuration(tasks);
  
  // Group tasks by capability
  const tasksByCapability = groupTasksByCapability(tasks);
  const capabilities = Object.keys(tasksByCapability);
  
  return (
    <div className={`plan-card plan-card--${riskLevel}`}>
      {/* Header */}
      <div className="plan-card__header">
        <div className="plan-card__title-row">
          <span className="plan-card__icon">{riskIcon}</span>
          <h3 className="plan-card__title">Execution Plan</h3>
          <span className="plan-card__badge" style={{ backgroundColor: riskColor }}>
            {totalSteps} step{totalSteps !== 1 ? 's' : ''}
          </span>
        </div>
        
        <p className="plan-card__goal">{goal}</p>
        
        {estimatedMinutes > 0 && (
          <div className="plan-card__estimate">
            <span className="plan-card__estimate-icon">⏱</span>
            <span>~{estimatedMinutes} minute{estimatedMinutes !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
      
      {/* Risk Warning */}
      {riskLevel === 'high' && (
        <div className="plan-card__warning">
          <span className="plan-card__warning-icon">⚠️</span>
          <span>This plan includes high-risk operations. Please review carefully.</span>
        </div>
      )}
      
      {metadata.reasoning && (
        <div className="plan-card__reasoning">
          <span className="plan-card__reasoning-label">Strategy:</span>
          <span>{metadata.reasoning}</span>
        </div>
      )}
      
      {/* Milestones (if complex plan) */}
      {milestones.length > 0 && (
        <div className="plan-card__section">
          <h4 className="plan-card__section-title">Milestones</h4>
          <div className="plan-card__milestones">
            {milestones.map((milestone, idx) => (
              <div key={milestone.id || idx} className="plan-card__milestone">
                <span className="plan-card__milestone-num">{idx + 1}</span>
                <span className="plan-card__milestone-name">{milestone.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Task Preview */}
      <div className="plan-card__section">
        <div className="plan-card__section-header">
          <h4 className="plan-card__section-title">Tasks</h4>
          {totalSteps > 5 && (
            <button 
              className="plan-card__expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Show less' : `Show all ${totalSteps}`}
            </button>
          )}
        </div>
        
        <div className="plan-card__tasks">
          {(isExpanded ? tasks : tasks.slice(0, 5)).map((task, idx) => (
            <TaskItem key={task.id || idx} task={task} index={idx} />
          ))}
          
          {!isExpanded && totalSteps > 5 && (
            <div className="plan-card__task-more">
              + {totalSteps - 5} more task{totalSteps - 5 !== 1 ? 's' : ''}...
            </div>
          )}
        </div>
      </div>
      
      {/* Capabilities Summary */}
      {capabilities.length > 0 && (
        <div className="plan-card__capabilities">
          <span className="plan-card__capabilities-label">Will use:</span>
          {capabilities.map(cap => (
            <span key={cap} className="plan-card__capability-badge">
              {formatCapability(cap)}
            </span>
          ))}
        </div>
      )}
      
      {/* Actions */}
      <div className="plan-card__actions">
        <button 
          className="plan-card__btn plan-card__btn--reject"
          onClick={onReject}
        >
          <span className="plan-card__btn-icon">✕</span>
          <span>Cancel</span>
        </button>
        
        <button 
          className="plan-card__btn plan-card__btn--approve"
          onClick={onApprove}
        >
          <span className="plan-card__btn-icon">✓</span>
          <span>Approve & Execute</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Individual Task Item Component
 */
function TaskItem({ task, index }) {
  const {
    step_id,
    description,
    goal_slice,
    capability,
    tool_id,
    estimated_duration_ms,
    requires_approval,
    risk_level = 'low',
    args = {},
    dependencies = [],
    parallel_safe = false,
    branches = [],
    loop = null,
    verification = null
  } = task;
  
  const displayText = description || goal_slice || `Task ${index + 1}`;
  const toolName = tool_id || capability;
  const argEntries = Object.entries(args || {}).slice(0, 3);
  const branchList = Array.isArray(branches) ? branches : [];
  const depList = Array.isArray(dependencies) ? dependencies : [];
  
  const badgeFlags = [];
  if (parallel_safe) badgeFlags.push('Parallel-safe');
  if (loop) {
    const loopText = typeof loop === 'string'
      ? loop
      : loop.description || loop.condition || 'Loop';
    badgeFlags.push(`Loop: ${loopText}`);
  }
  
  return (
    <div className={`plan-card__task plan-card__task--${risk_level}`}>
      <span className="plan-card__task-num">{index + 1}</span>
      <div className="plan-card__task-content">
        <span className="plan-card__task-desc">{displayText}</span>
        {toolName && (
          <span className="plan-card__task-tool">{formatCapability(toolName)}</span>
        )}
        {argEntries.length > 0 && (
          <div className="plan-card__task-meta">
            {argEntries.map(([key, value]) => {
              const text = String(value ?? '');
              const preview = text.length > 80 ? `${text.slice(0, 77)}...` : text;
              return (
                <span key={key} className="plan-card__task-arg">
                  <span className="plan-card__task-arg-key">{key}:</span> {preview}
                </span>
              );
            })}
          </div>
        )}
        {depList.length > 0 && (
          <div className="plan-card__task-meta-line">
            <span className="plan-card__task-meta-label">Depends on:</span>
            <span>{depList.join(', ')}</span>
          </div>
        )}
        {(badgeFlags.length > 0 || branchList.length > 0 || verification) && (
          <div className="plan-card__task-flags">
            {badgeFlags.map((flag, idx) => (
              <span key={`flag-${idx}`} className="plan-card__task-flag">{flag}</span>
            ))}
            {branchList.map((branch, idx) => (
              <span key={`branch-${idx}`} className="plan-card__task-flag">Branch: {branch}</span>
            ))}
            {verification && (
              <span className="plan-card__task-flag plan-card__task-flag--muted">
                Verify: {verification}
              </span>
            )}
          </div>
        )}
      </div>
      {requires_approval && (
        <span className="plan-card__task-lock" title="Requires approval">🔒</span>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function determineRiskLevel(tasks) {
  if (!tasks || tasks.length === 0) return 'low';
  
  const highRiskTools = ['MAIL.SEND', 'FILE.DELETE', 'DB.EXECUTE', 'SYSTEM.SHUTDOWN'];
  const hasHighRisk = tasks.some(t => 
    highRiskTools.includes(t.tool_id) || t.risk_level === 'high'
  );
  
  if (hasHighRisk) return 'high';
  
  const mediumRiskTools = ['FILE.WRITE', 'SHELL.RUN', 'DEPLOY'];
  const hasMediumRisk = tasks.some(t =>
    mediumRiskTools.includes(t.tool_id) || t.risk_level === 'medium'
  );
  
  if (hasMediumRisk) return 'medium';
  
  return 'low';
}

function getRiskColor(riskLevel) {
  const colors = {
    low: '#4ade80',    // green
    medium: '#fbbf24', // amber
    high: '#ef4444'    // red
  };
  return colors[riskLevel] || colors.low;
}

function getRiskIcon(riskLevel) {
  const icons = {
    low: '🎯',
    medium: '⚡',
    high: '🔥'
  };
  return icons[riskLevel] || icons.low;
}

function estimateDuration(tasks) {
  // Simple heuristic: 30 seconds per task
  return Math.ceil((tasks.length * 30) / 60);
}

function groupTasksByCapability(tasks) {
  const groups = {};
  tasks.forEach(task => {
    const cap = task.tool_id || task.capability || 'OTHER';
    groups[cap] = (groups[cap] || 0) + 1;
  });
  return groups;
}

function formatCapability(capability) {
  if (!capability) return '';
  
  // Convert "MAIL.SEND" → "Mail"
  const parts = capability.split('.');
  const base = parts[0].toLowerCase();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default PlanCard;
