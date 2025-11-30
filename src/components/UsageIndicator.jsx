/**
 * Usage Indicator Component
 * 
 * Displays current usage against plan limits with visual feedback
 */
import { useState, useEffect } from 'react';

export function UsageIndicator({ tenantId = 'test-tenant-001' }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsage();
  }, [tenantId]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v2/usage/${tenantId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch usage');
      }
      
      const data = await response.json();
      setUsage(data);
      setError(null);
    } catch (err) {
      console.error('[UsageIndicator] Error fetching usage:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getColor = () => {
    if (!usage || !usage.limit) return '#10b981'; // Green for unlimited
    
    const percentage = (usage.current / usage.limit) * 100;
    
    if (percentage >= 100) return '#ef4444'; // Red
    if (percentage >= 90) return '#f59e0b'; // Orange
    if (percentage >= 75) return '#eab308'; // Yellow
    return '#10b981'; // Green
  };

  const getBackgroundColor = () => {
    if (!usage || !usage.limit) return '#d1fae5';
    
    const percentage = (usage.current / usage.limit) * 100;
    
    if (percentage >= 100) return '#fee2e2';
    if (percentage >= 90) return '#fed7aa';
    if (percentage >= 75) return '#fef3c7';
    return '#d1fae5';
  };

  const getPercentage = () => {
    if (!usage || !usage.limit) return 0;
    return Math.min(100, (usage.current / usage.limit) * 100);
  };

  const getMessage = () => {
    if (!usage) return '';
    
    if (!usage.limit) {
      return 'Unlimited conversations';
    }
    
    const remaining = usage.limit - usage.current;
    
    if (remaining <= 0) {
      return `Limit reached! Upgrade to continue.`;
    }
    
    if (remaining <= 2) {
      return `Only ${remaining} conversation${remaining === 1 ? '' : 's'} remaining`;
    }
    
    return `${remaining} conversations remaining`;
  };

  if (loading) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        Loading usage...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: '#fee2e2',
        borderRadius: '8px',
        fontSize: '14px',
        color: '#991b1b'
      }}>
        ⚠️ Could not load usage: {error}
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const showUpgrade = usage.limit && usage.current >= usage.limit;
  const showWarning = usage.limit && (usage.current / usage.limit) >= 0.9;

  return (
    <div style={{
      padding: '16px',
      backgroundColor: getBackgroundColor(),
      borderRadius: '8px',
      border: `2px solid ${getColor()}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
      }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          Usage - {usage.plan ? usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) : 'Free'} Plan
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: getColor() }}>
          {usage.limit ? `${usage.current}/${usage.limit}` : `${usage.current} (unlimited)`}
        </div>
      </div>

      {/* Progress Bar */}
      {usage.limit && (
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          <div style={{
            width: `${getPercentage()}%`,
            height: '100%',
            backgroundColor: getColor(),
            transition: 'width 0.3s ease'
          }} />
        </div>
      )}

      {/* Message */}
      <div style={{
        fontSize: '13px',
        color: '#6b7280',
        marginBottom: showUpgrade || showWarning ? '12px' : '0'
      }}>
        {getMessage()}
      </div>

      {/* Upgrade Button */}
      {showUpgrade && (
        <button
          onClick={() => window.location.hash = '#/settings?tab=billing'}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
        >
          🚀 Upgrade Now
        </button>
      )}

      {/* Warning */}
      {showWarning && !showUpgrade && (
        <div style={{
          padding: '8px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>Running low on conversations</span>
          <button
            onClick={() => window.location.hash = '#/settings?tab=billing'}
            style={{
              marginLeft: 'auto',
              padding: '4px 12px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchUsage}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '6px',
          backgroundColor: 'transparent',
          color: '#6b7280',
          border: '1px solid #d1d5db',
          borderRadius: '4px',
          fontSize: '12px',
          cursor: 'pointer'
        }}
      >
        🔄 Refresh Usage
      </button>
    </div>
  );
}
