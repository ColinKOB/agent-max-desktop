/**
 * Approval Dialog Component
 * 
 * Universal modal for requesting approval for gated operations
 * Shows action, reason, markers, and optional preview
 * 
 * Design System:
 * - Modal: var(--panel-strong) with strong blur
 * - Backdrop: Dark with blur
 * - Buttons: Glass panels with accent for primary action
 * - High risk: Subtle red indicator
 */
import { useEffect, useState } from 'react';

export default function ApprovalDialog({
  open = false,
  onClose,
  action = '',
  markers = [],
  reason = '',
  preview = null,
  onApprove,
  onEdit = null,
  isHighRisk = false,
  approveButtonText = 'Approve',
  showDontAskAgain = false,
  dontAskAgainKey = null
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  
  if (!open) return null;
  
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
          animation: 'fadeIn 0.18s ease-out'
        }}
        role="presentation"
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-dialog-title"
        aria-describedby="approval-dialog-description"
        onClick={(e) => e.stopPropagation()}
        className="approval-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          // Use a near-opaque panel to maximize readability over busy backgrounds
          background: 'rgba(16, 16, 18, 0.96)',
          backdropFilter: 'saturate(120%) blur(var(--blur-strong))',
          WebkitBackdropFilter: 'saturate(120%) blur(var(--blur-strong))',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 'calc(var(--radius) + 6px)', // 18px
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          zIndex: 10000,
          animation: 'slideUp 0.18s ease-out'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h2
            id="approval-dialog-title"
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: 0
            }}
          >
            ⚠️ Approval Required
            {isHighRisk && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  background: 'hsla(0, 100%, 70%, 0.2)',
                  border: '1px solid hsla(0, 100%, 70%, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'hsl(0, 100%, 80%)',
                  fontWeight: 500
                }}
              >
                High Risk
              </span>
            )}
          </h2>
          <p
            id="approval-dialog-description"
            style={{
              fontSize: '1rem',
              marginTop: '0.5rem',
              color: '#ffffff',
              lineHeight: '1.5',
              margin: '0.5rem 0 0 0',
              fontWeight: 500
            }}
          >
            {action}
          </p>
        </div>
        
        {/* Reason and markers */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p
            style={{
              fontSize: '0.95rem',
              color: '#ffffff',
              marginBottom: '0.5rem',
              margin: '0 0 0.75rem 0',
              fontWeight: 600
            }}
          >
            Why approval is needed
          </p>
          {/* Friendly summary first */}
          {reason && (
            <div
              style={{
                color: 'rgba(255,255,255,0.95)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                lineHeight: 1.5,
                fontSize: '0.95rem'
              }}
            >
              {reason}
            </div>
          )}
          {/* Toggle for technical details */}
          <div style={{ marginTop: '0.75rem' }}>
            <button
              onClick={() => setShowDetails(v => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.85rem'
              }}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          </div>
          {showDetails && (
            <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.6rem' }}>
              {markers.map((marker, i) => (
                <span
                  key={i}
                  style={{
                    padding: '0.35rem 0.6rem',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.16)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    color: '#ffffff',
                    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'
                  }}
                >
                  {marker}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: '1.5rem' }}>
            {preview}
          </div>
        )}
        
        {/* Don't ask again checkbox */}
        {showDontAskAgain && dontAskAgainKey && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: 'rgba(255,255,255,0.9)'
              }}
            >
              <input
                type="checkbox"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: 'var(--accent)'
                }}
              />
              Don't ask again
            </label>
          </div>
        )}
        
        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <Button
            onClick={onClose}
            variant="secondary"
            label="Cancel"
          />
          
          {onEdit && (
            <Button
              onClick={onEdit}
              variant="secondary"
              label="Edit"
            />
          )}
          
          <Button
            onClick={() => {
              // If "don't ask again" is checked, store preference
              if (dontAskAgain && dontAskAgainKey) {
                localStorage.setItem(`approval_skip_${dontAskAgainKey}`, 'true');
              }
              onApprove(dontAskAgain);
              onClose();
            }}
            variant="primary"
            label={approveButtonText}
            isHighRisk={isHighRisk}
          />
        </div>
      </div>
      
      <style>{`
        /* Scoped styles to ensure high-contrast text inside modal */
        .approval-modal, .approval-modal * { color: var(--text, #ffffff); }
        .approval-modal a { color: var(--text, #ffffff); text-decoration: none; }
        .approval-modal .muted { color: rgba(255,255,255,0.85); }
        .approval-modal .chips span { color: var(--text, #ffffff); }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
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

// Button sub-component
function Button({ onClick, variant = 'secondary', label, isHighRisk = false }) {
  const isPrimary = variant === 'primary';
  
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.625rem 1.25rem',
        background: isPrimary ? 'var(--accent)' : 'var(--panel)',
        backdropFilter: isPrimary ? 'none' : 'saturate(120%) blur(var(--blur))',
        WebkitBackdropFilter: isPrimary ? 'none' : 'saturate(120%) blur(var(--blur))',
        border: isPrimary ? '1px solid var(--accent)' : '1px solid var(--stroke)',
        borderRadius: 'var(--radius)',
        color: '#ffffff',
        fontSize: '0.875rem',
        fontWeight: isPrimary ? 600 : 500,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        boxShadow: isPrimary ? '0 4px 12px var(--accent-glow)' : '0 0 0 1px rgba(255,255,255,0.08) inset',
        outline: 'none'
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.filter = 'brightness(1.1)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        } else {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }
      }}
      onMouseLeave={(e) => {
        if (isPrimary) {
          e.currentTarget.style.filter = 'brightness(1)';
          e.currentTarget.style.transform = 'translateY(0)';
        } else {
          e.currentTarget.style.background = 'var(--panel)';
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = isPrimary
          ? '0 0 0 3px var(--accent-glow)'
          : '0 0 0 2px var(--accent)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = isPrimary
          ? '0 4px 12px var(--accent-glow)'
          : 'none';
      }}
    >
      {label}
    </button>
  );
}
