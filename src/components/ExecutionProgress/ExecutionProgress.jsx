import React from 'react';
import { Check, Loader2, X, Circle } from 'lucide-react';
import './ExecutionProgress.css';

/**
 * ExecutionProgress - Visual checklist showing step-by-step progress
 * 
 * Props:
 * - steps: Array of step objects with {id, description, goal, tool_name}
 * - stepStatuses: Object mapping step index to status ('pending'|'running'|'done'|'failed')
 * - currentStep: Current step index
 * - summary: Final summary object when execution completes
 */
export default function ExecutionProgress({ steps, stepStatuses, currentStep, summary }) {
  if (!steps || steps.length === 0) {
    return null;
  }

  return (
    <div className="execution-progress">
      <div className="execution-progress-header">
        <h3>Execution Progress</h3>
        {summary && (
          <span className={`execution-status ${summary.status}`}>
            {summary.status === 'complete' ? '✅ Complete' : '❌ Failed'}
          </span>
        )}
      </div>

      <div className="execution-steps">
        {steps.map((step, index) => {
          const status = stepStatuses[index] || 'pending';
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id || index}
              className={`execution-step ${status} ${isCurrent ? 'current' : ''}`}
            >
              <div className="step-indicator">
                {status === 'done' && (
                  <div className="step-icon done">
                    <Check size={16} />
                  </div>
                )}
                {status === 'running' && (
                  <div className="step-icon running">
                    <Loader2 size={16} className="spinner" />
                  </div>
                )}
                {status === 'failed' && (
                  <div className="step-icon failed">
                    <X size={16} />
                  </div>
                )}
                {status === 'pending' && (
                  <div className="step-icon pending">
                    <Circle size={16} />
                  </div>
                )}
              </div>

              <div className="step-content">
                <div className="step-number">Step {index + 1}</div>
                <div className="step-description">{step.description}</div>
                {step.tool_name && (
                  <div className="step-tool">{step.tool_name}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {summary && (
        <div className={`execution-summary ${summary.status}`}>
          <div className="summary-message">{summary.message}</div>
          {summary.goalAchieved !== undefined && (
            <div className="summary-stats">
              <span className="stat">
                ✅ {summary.successCount} succeeded
              </span>
              {summary.failedCount > 0 && (
                <span className="stat">
                  ❌ {summary.failedCount} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
