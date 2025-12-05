/**
 * Intent Confirmation Modal Component
 *
 * Shows the AI's understanding of the user's request before execution begins.
 * Users can approve to proceed, or reject to refine their request.
 *
 * Design matches existing ApprovalDialog style for consistency.
 */
import { useEffect, useState } from 'react';

export default function IntentConfirmationModal({
  open = false,
  onClose,
  intentData = null,
  onConfirm,
  onReject,
  timeoutSeconds = 60
}) {
  const [remainingTime, setRemainingTime] = useState(timeoutSeconds);
  const [showDetails, setShowDetails] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (!open || !intentData) return;

    setRemainingTime(timeoutSeconds);

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Auto-reject on timeout
          onReject?.('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, intentData, timeoutSeconds, onReject]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose?.();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !intentData) return null;

  const {
    detected_intent,
    planned_actions = [],
    assumptions = [],
    estimated_steps,
    estimated_duration,
    confidence = 0.8
  } = intentData;

  // Confidence color
  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'hsl(142, 70%, 50%)'; // Green
    if (conf >= 0.6) return 'hsl(45, 100%, 50%)'; // Yellow
    return 'hsl(0, 100%, 60%)'; // Red
  };

  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor = getConfidenceColor(confidence);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          background: 'rgba(0, 0, 0, 0.6)',
          animation: 'intentFadeIn 0.18s ease-out'
        }}
        role="presentation"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intent-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="intent-confirmation-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '550px',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'rgba(16, 16, 18, 0.96)',
          backdropFilter: 'saturate(120%) blur(var(--blur-strong, 20px))',
          WebkitBackdropFilter: 'saturate(120%) blur(var(--blur-strong, 20px))',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '18px',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          zIndex: 10000,
          animation: 'intentSlideUp 0.18s ease-out'
        }}
      >
        {/* Header with timer */}
        <div style={{
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2
              id="intent-dialog-title"
              style={{
                fontSize: '1.15rem',
                fontWeight: 600,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🎯</span>
              Before I start...
            </h2>
            <p style={{
              fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.6)',
              margin: '0.35rem 0 0 0'
            }}>
              Here's what I understood from your request
            </p>
          </div>

          {/* Timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 0.65rem',
            background: remainingTime <= 10 ? 'rgba(255, 100, 100, 0.15)' : 'rgba(255,255,255,0.06)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: remainingTime <= 10 ? 'hsl(0, 100%, 75%)' : 'rgba(255,255,255,0.7)'
          }}>
            <span>⏱</span>
            <span>{remainingTime}s</span>
          </div>
        </div>

        {/* Intent Summary */}
        <div style={{
          background: 'rgba(100, 180, 255, 0.08)',
          border: '1px solid rgba(100, 180, 255, 0.2)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <p style={{
            fontSize: '1rem',
            color: '#ffffff',
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 500
          }}>
            {detected_intent}
          </p>
        </div>

        {/* Planned Actions */}
        {planned_actions.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
              margin: '0 0 0.5rem 0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              What I'll do
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem'
            }}>
              {planned_actions.map((action, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.9)'
                  }}
                >
                  <span style={{
                    color: 'var(--accent, hsl(210, 100%, 60%))',
                    fontWeight: 600,
                    minWidth: '1.25rem'
                  }}>
                    {i + 1}.
                  </span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assumptions (collapsible) */}
        {assumptions.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span style={{
                transform: showDetails ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
                display: 'inline-block'
              }}>▶</span>
              {showDetails ? 'Hide' : 'Show'} assumptions ({assumptions.length})
            </button>

            {showDetails && (
              <div style={{
                marginTop: '0.5rem',
                paddingLeft: '0.5rem',
                borderLeft: '2px solid rgba(255,255,255,0.1)'
              }}>
                {assumptions.map((assumption, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: '0.85rem',
                      color: 'rgba(255,255,255,0.65)',
                      margin: '0.35rem 0',
                      paddingLeft: '0.5rem'
                    }}
                  >
                    • {assumption}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Meta info row */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255,255,255,0.08)'
        }}>
          {/* Estimated steps */}
          {estimated_steps && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.6)'
            }}>
              <span>📊</span>
              <span>~{estimated_steps} steps</span>
            </div>
          )}

          {/* Duration */}
          {estimated_duration && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.6)'
            }}>
              <span>⏰</span>
              <span>{estimated_duration}</span>
            </div>
          )}

          {/* Confidence */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.6)'
          }}>
            <span style={{ color: confidenceColor }}>●</span>
            <span>{confidencePercent}% confident</span>
          </div>
        </div>

        {/* Low confidence warning */}
        {confidence < 0.7 && (
          <div style={{
            background: 'rgba(255, 180, 50, 0.1)',
            border: '1px solid rgba(255, 180, 50, 0.25)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            color: 'hsl(40, 100%, 70%)'
          }}>
            ⚠️ I'm not fully certain about this request. Consider providing more details if I misunderstood.
          </div>
        )}

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => onReject?.('user')}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            Let me clarify
          </button>

          <button
            onClick={() => onConfirm?.()}
            style={{
              padding: '0.625rem 1.5rem',
              background: 'var(--accent, hsl(210, 100%, 50%))',
              border: '1px solid var(--accent, hsl(210, 100%, 50%))',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 12px rgba(100, 150, 255, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.1)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'brightness(1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Looks good, proceed
          </button>
        </div>
      </div>

      <style>{`
        .intent-confirmation-modal, .intent-confirmation-modal * {
          color: var(--text, #ffffff);
        }

        @keyframes intentFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes intentSlideUp {
          from {
            opacity: 0;
            transform: translate(-50%, -45%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </>
  );
}
