/**
 * Execution Plan Display Component
 * Shows the AI's execution plan before and during autonomous task execution
 */
import React from 'react';
import { CheckCircle, Circle, Clock, Zap } from 'lucide-react';

const ExecutionPlan = ({ plan, currentStep = 0, onApprove, onCancel }) => {
  if (!plan || !plan.steps) return null;

  const { steps, total_steps, estimated_time, reasoning } = plan;

  return (
    <div className="execution-plan" style={{
      background: 'rgba(33, 150, 243, 0.08)',
      border: '1px solid rgba(33, 150, 243, 0.2)',
      borderRadius: '12px',
      padding: '12px',
      margin: '8px 0',
      fontSize: '0.85rem'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        marginBottom: '8px',
        color: '#2196F3'
      }}>
        <Zap size={16} />
        <strong>Execution Plan</strong>
        {currentStep > 0 && (
          <span style={{ 
            marginLeft: 'auto',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.7)'
          }}>
            Step {currentStep} of {total_steps}
          </span>
        )}
      </div>

      {/* Reasoning */}
      {reasoning && currentStep === 0 && (
        <div style={{
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.8)',
          marginBottom: '12px',
          padding: '8px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '6px',
          fontStyle: 'italic'
        }}>
          💭 {reasoning}
        </div>
      )}

      {/* Steps */}
      <div className="plan-steps" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {steps.map((step, idx) => {
          const stepNum = step.step_number || idx + 1;
          const isComplete = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isPending = currentStep < stepNum;

          return (
            <div
              key={stepNum}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '6px 8px',
                background: isCurrent ? 'rgba(33, 150, 243, 0.15)' : 'rgba(0,0,0,0.1)',
                borderRadius: '6px',
                border: isCurrent ? '1px solid rgba(33, 150, 243, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                opacity: isPending ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {/* Status icon */}
              <div style={{ flexShrink: 0, marginTop: '2px' }}>
                {isComplete ? (
                  <CheckCircle size={16} style={{ color: '#4CAF50' }} />
                ) : isCurrent ? (
                  <div className="spinner" style={{ 
                    width: 16, 
                    height: 16,
                    border: '2px solid rgba(33, 150, 243, 0.3)',
                    borderTopColor: '#2196F3',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                ) : (
                  <Circle size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                )}
              </div>

              {/* Step content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: isCurrent ? 600 : 400,
                  color: isComplete ? '#4CAF50' : isCurrent ? '#2196F3' : 'rgba(255,255,255,0.7)',
                  marginBottom: '2px'
                }}>
                  {step.description}
                </div>
                
                {/* Show command on hover or when current */}
                {(isCurrent || isComplete) && step.command && (
                  <code style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.5)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    marginTop: '4px'
                  }}>
                    {step.command}
                  </code>
                )}
              </div>

              {/* Estimated time */}
              {step.estimated_time && isPending && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  color: 'rgba(255,255,255,0.5)',
                  flexShrink: 0
                }}>
                  <Clock size={12} />
                  {step.estimated_time}s
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer with meta info */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.7)'
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span>⏱️ ~{estimated_time}s</span>
          <span>📋 {total_steps} steps</span>
        </div>

        {/* Approval buttons (only show if not executing) */}
        {currentStep === 0 && onApprove && onCancel && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onCancel}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={onApprove}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                background: '#2196F3',
                border: '1px solid rgba(33, 150, 243, 0.5)',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Proceed
            </button>
          </div>
        )}
      </div>

      {/* Add spinner keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExecutionPlan;
