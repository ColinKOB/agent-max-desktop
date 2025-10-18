/**
 * Autonomous Progress Component
 * 
 * Shows execution progress with step counter and progress bar
 */
import { useState, useEffect } from 'react';

export function AutonomousProgress({ 
  currentStep = 0,
  totalSteps = 0,
  status = 'idle',
  onPause,
  onStop
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (totalSteps > 0) {
      setProgress((currentStep / totalSteps) * 100);
    } else {
      setProgress(0);
    }
  }, [currentStep, totalSteps]);

  const getStatusColor = () => {
    switch (status) {
      case 'running': return '#10b981'; // Green
      case 'paused': return '#f59e0b'; // Orange
      case 'complete': return '#3b82f6'; // Blue
      case 'error': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const getStatusEmoji = () => {
    switch (status) {
      case 'running': return '🚀';
      case 'paused': return '⏸️';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⭕';
    }
  };

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      border: `2px solid ${getStatusColor()}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>{getStatusEmoji()}</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
            Step {currentStep} of {totalSteps || '?'}
          </span>
        </div>
        
        <div style={{ fontSize: '13px', color: '#6b7280', textTransform: 'capitalize' }}>
          {status}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '12px',
        backgroundColor: '#e5e7eb',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          backgroundColor: getStatusColor(),
          transition: 'width 0.3s ease',
          borderRadius: '6px'
        }} />
      </div>

      {/* Progress Percentage */}
      <div style={{
        fontSize: '12px',
        color: '#9ca3af',
        textAlign: 'center',
        marginBottom: totalSteps > 0 ? '12px' : '0'
      }}>
        {totalSteps > 0 ? `${Math.round(progress)}% complete` : 'Initializing...'}
      </div>

      {/* Control Buttons */}
      {status === 'running' && (onPause || onStop) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginTop: '12px'
        }}>
          {onPause && (
            <button
              onClick={onPause}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#d97706'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#f59e0b'}
            >
              ⏸️ Pause
            </button>
          )}
          
          {onStop && (
            <button
              onClick={onStop}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
            >
              ⏹️ Stop
            </button>
          )}
        </div>
      )}

      {/* Paused State Resume Button */}
      {status === 'paused' && onPause && (
        <button
          onClick={onPause}
          style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer',
            marginTop: '12px',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
        >
          ▶️ Resume
        </button>
      )}
    </div>
  );
}
