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
import { useEffect } from 'react';

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
  approveButtonText = 'Approve'
}) {
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
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--panel-strong)', // 82% opacity
          backdropFilter: 'saturate(120%) blur(var(--blur-strong))',
          WebkitBackdropFilter: 'saturate(120%) blur(var(--blur-strong))',
          border: '1px solid var(--stroke)',
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
              color: 'var(--text)',
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
              color: 'var(--text)',
              lineHeight: '1.5',
              margin: '0.5rem 0 0 0'
            }}
          >
            {action}
          </p>
        </div>
        
        {/* Reason and markers */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
              margin: '0 0 0.5rem 0'
            }}
          >
            Why approval is needed:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {markers.map((marker, i) => (
              <span
                key={i}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--panel)',
                  border: '1px solid var(--stroke)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'monospace'
                }}
              >
                {marker}
              </span>
            ))}
          </div>
          {reason && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-muted)',
                marginTop: '0.75rem',
                lineHeight: '1.5',
                margin: '0.75rem 0 0 0'
              }}
            >
              {reason}
            </p>
          )}
        </div>
        
        {/* Preview */}
        {preview && (
          <div style={{ marginBottom: '1.5rem' }}>
            {preview}
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
              onApprove();
              onClose();
            }}
            variant="primary"
            label={approveButtonText}
            isHighRisk={isHighRisk}
          />
        </div>
      </div>
      
      <style>{`
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
        color: isPrimary ? 'var(--bg)' : 'var(--text)',
        fontSize: '0.875rem',
        fontWeight: isPrimary ? 600 : 500,
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        boxShadow: isPrimary ? '0 4px 12px var(--accent-glow)' : 'none',
        outline: 'none'
      }}
      onMouseEnter={(e) => {
        if (isPrimary) {
          e.currentTarget.style.filter = 'brightness(1.1)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        } else {
          e.currentTarget.style.background = 'var(--panel-strong)';
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
