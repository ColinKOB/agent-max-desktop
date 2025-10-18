/**
 * Autonomous Step Card Component
 * 
 * Displays individual step details with status, action, and screenshot
 */
import { useState } from 'react';

export function AutonomousStepCard({ 
  stepNumber,
  actionType,
  actionArgs,
  status = 'pending', // pending, running, success, failed
  screenshot,
  error
}) {
  const [showFullImage, setShowFullImage] = useState(false);

  const getStatusColor = () => {
    switch (status) {
      case 'running': return '#3b82f6'; // Blue
      case 'success': return '#10b981'; // Green
      case 'failed': return '#ef4444'; // Red
      default: return '#9ca3af'; // Gray
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running': return '⏳';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '⭕';
    }
  };

  const formatActionArgs = () => {
    if (!actionArgs) return null;
    
    const formatted = [];
    for (const [key, value] of Object.entries(actionArgs)) {
      if (typeof value === 'string' && value.length > 50) {
        formatted.push(`${key}: ${value.substring(0, 50)}...`);
      } else {
        formatted.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
    return formatted;
  };

  return (
    <>
      <div style={{
        padding: '12px',
        backgroundColor: '#ffffff',
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '8px',
        marginBottom: '8px'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{getStatusIcon()}</span>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
              Step {stepNumber}
            </span>
            <span style={{ 
              fontSize: '11px',
              padding: '2px 8px',
              backgroundColor: getStatusColor(),
              color: 'white',
              borderRadius: '4px',
              textTransform: 'capitalize'
            }}>
              {status}
            </span>
          </div>
        </div>

        {/* Action Type */}
        <div style={{
          fontSize: '14px',
          fontWeight: '500',
          color: '#1f2937',
          marginBottom: '4px',
          fontFamily: 'monospace'
        }}>
          {actionType}
        </div>

        {/* Action Arguments */}
        {actionArgs && (
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginBottom: '8px'
          }}>
            {formatActionArgs().map((arg, i) => (
              <div key={i} style={{ 
                padding: '2px 0',
                fontFamily: 'monospace',
                fontSize: '11px'
              }}>
                • {arg}
              </div>
            ))}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '8px',
            backgroundColor: '#fee2e2',
            borderLeft: '3px solid #ef4444',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#991b1b',
            marginTop: '8px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Screenshot Thumbnail */}
        {screenshot && (
          <div style={{ marginTop: '8px' }}>
            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              Screenshot:
            </div>
            <img
              src={screenshot}
              alt={`Step ${stepNumber} screenshot`}
              style={{
                width: '100%',
                maxHeight: '150px',
                objectFit: 'cover',
                borderRadius: '4px',
                cursor: 'pointer',
                border: '1px solid #e5e7eb'
              }}
              onClick={() => setShowFullImage(true)}
            />
            <div style={{
              fontSize: '10px',
              color: '#9ca3af',
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              Click to enlarge
            </div>
          </div>
        )}
      </div>

      {/* Full Image Modal */}
      {showFullImage && screenshot && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            cursor: 'pointer'
          }}
          onClick={() => setShowFullImage(false)}
        >
          <img
            src={screenshot}
            alt={`Step ${stepNumber} full screenshot`}
            style={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              borderRadius: '8px'
            }}
          />
        </div>
      )}
    </>
  );
}
