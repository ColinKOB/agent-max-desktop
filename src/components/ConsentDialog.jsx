/**
 * Consent Dialog Component
 * 
 * Shows a confirmation dialog before executing risky/destructive actions
 */
import { useState } from 'react';

export function ConsentDialog({ 
  action,
  onApprove, 
  onDeny,
  isRisky = false
}) {
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleApprove = () => {
    onApprove(rememberChoice);
  };

  const handleDeny = () => {
    onDeny(rememberChoice);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '32px' }}>⚠️</span>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            Confirm Action
          </h3>
        </div>

        {/* Risk Warning */}
        {isRisky && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderLeft: '4px solid #f59e0b',
            borderRadius: '4px',
            marginBottom: '16px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400e', fontWeight: '500' }}>
              ⚠️ This action may modify system state or perform destructive operations
            </p>
          </div>
        )}

        {/* Action Details */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
            About to perform:
          </p>
          <div style={{
            padding: '12px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            marginBottom: '12px'
          }}>
            <p style={{ 
              margin: 0, 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#1f2937',
              fontFamily: 'monospace'
            }}>
              {action?.type || 'Unknown Action'}
            </p>
          </div>

          {/* Arguments */}
          {action?.args && Object.keys(action.args).length > 0 && (
            <div style={{
              padding: '12px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
                Parameters:
              </p>
              {Object.entries(action.args).map(([key, value]) => (
                <div key={key} style={{
                  fontSize: '13px',
                  color: '#374151',
                  marginBottom: '4px',
                  fontFamily: 'monospace'
                }}>
                  <span style={{ color: '#6b7280' }}>{key}:</span>{' '}
                  <span style={{ fontWeight: '500' }}>
                    {typeof value === 'string' && value.length > 50 
                      ? value.substring(0, 50) + '...' 
                      : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remember Choice */}
        <div style={{
          marginBottom: '20px',
          padding: '8px',
          backgroundColor: '#f9fafb',
          borderRadius: '6px'
        }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#374151'
          }}>
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer'
              }}
            />
            Remember my choice for similar actions
          </label>
        </div>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleDeny}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f3f4f6';
            }}
          >
            ❌ Deny
          </button>
          <button
            onClick={handleApprove}
            style={{
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#059669';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#10b981';
            }}
          >
            ✅ Approve
          </button>
        </div>
      </div>

      {/* Inject animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
