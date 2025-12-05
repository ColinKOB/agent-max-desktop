/**
 * Retry Notification Component
 *
 * Shows users when a step is being retried and why.
 * Allows users to cancel retry attempts if they want to try something different.
 *
 * Design matches existing modal styles for consistency.
 */
import { useEffect, useState } from 'react';

export default function RetryNotification({
  visible = false,
  retryData = null,
  onCancel,
  onDismiss
}) {
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss after successful retry
  useEffect(() => {
    if (retryData?.type === 'retry_success') {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss?.(), 200);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [retryData, onDismiss]);

  if (!visible || !retryData) return null;

  const {
    attempt = 1,
    max_attempts = 3,
    original_error = 'Something went wrong',
    next_action = 'Retrying...',
    translated_error = {},
    suggestions = [],
    type = 'retry_notification'
  } = retryData;

  const isExhausted = type === 'retry_exhausted';
  const isSuccess = type === 'retry_success';

  // Get severity color
  const getSeverityColor = () => {
    if (isSuccess) return 'hsl(142, 70%, 45%)'; // Green
    if (isExhausted) return 'hsl(0, 70%, 55%)'; // Red
    return 'hsl(45, 100%, 50%)'; // Yellow for in-progress
  };

  const severityColor = getSeverityColor();

  return (
    <div
      className={`retry-notification ${isExiting ? 'exiting' : ''}`}
      style={{
        position: 'fixed',
        bottom: '100px',
        right: '20px',
        width: '340px',
        background: 'rgba(20, 20, 22, 0.95)',
        backdropFilter: 'saturate(120%) blur(20px)',
        WebkitBackdropFilter: 'saturate(120%) blur(20px)',
        border: `1px solid ${isExhausted ? 'rgba(255, 100, 100, 0.3)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '14px',
        padding: '1rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        zIndex: 9998,
        animation: isExiting ? 'retrySlideOut 0.2s ease-in' : 'retrySlideIn 0.2s ease-out'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {/* Status icon */}
          <span style={{ fontSize: '1.1rem' }}>
            {isSuccess ? '✅' : isExhausted ? '❌' : '🔄'}
          </span>

          {/* Title */}
          <span style={{
            fontWeight: 600,
            fontSize: '0.9rem',
            color: '#ffffff'
          }}>
            {isSuccess ? 'Retry Succeeded!' : isExhausted ? 'All Retries Failed' : `Retry ${attempt}/${max_attempts}`}
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onDismiss?.(), 200);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '1rem',
            lineHeight: 1
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Progress bar (only for in-progress retries) */}
      {!isSuccess && !isExhausted && (
        <div style={{
          height: '3px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          marginBottom: '0.75rem',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${(attempt / max_attempts) * 100}%`,
            height: '100%',
            background: severityColor,
            borderRadius: '2px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {/* Error message */}
      <p style={{
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.9)',
        margin: '0 0 0.5rem 0',
        lineHeight: 1.4
      }}>
        {isSuccess ? 'The operation completed successfully.' : original_error}
      </p>

      {/* What's happening next */}
      {!isSuccess && !isExhausted && next_action && (
        <p style={{
          fontSize: '0.8rem',
          color: severityColor,
          margin: '0 0 0.75rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          <span style={{
            display: 'inline-block',
            animation: 'retrySpin 1s linear infinite'
          }}>⟳</span>
          {next_action}
        </p>
      )}

      {/* Suggestions (for exhausted retries) */}
      {isExhausted && suggestions.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          padding: '0.6rem',
          marginBottom: '0.75rem'
        }}>
          <p style={{
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.6)',
            margin: '0 0 0.35rem 0',
            fontWeight: 500
          }}>
            Suggestions:
          </p>
          {suggestions.slice(0, 3).map((suggestion, i) => (
            <p
              key={i}
              style={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.8)',
                margin: '0.25rem 0',
                paddingLeft: '0.5rem'
              }}
            >
              • {suggestion}
            </p>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isSuccess && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem'
        }}>
          {!isExhausted && (
            <button
              onClick={() => onCancel?.()}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'rgba(255, 100, 100, 0.15)',
                border: '1px solid rgba(255, 100, 100, 0.3)',
                borderRadius: '8px',
                color: 'hsl(0, 100%, 75%)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 100, 100, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 100, 100, 0.15)';
              }}
            >
              Stop Retrying
            </button>
          )}

          {isExhausted && (
            <button
              onClick={() => {
                setIsExiting(true);
                setTimeout(() => onDismiss?.(), 200);
              }}
              style={{
                padding: '0.4rem 0.8rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}

      <style>{`
        @keyframes retrySlideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes retrySlideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(20px);
          }
        }

        @keyframes retrySpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
