/**
 * Activity Log Page
 * 
 * Shows audit trail of all actions with approval/denial history
 * Filterable by type, with glass morphism design
 * 
 * Design System:
 * - Glass cards for entries
 * - Subtle indicators for status
 * - Proper spacing and hierarchy
 */
import { useState, useEffect } from 'react';
import { permissionAPI } from '../services/api';

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [total, setTotal] = useState(0);
  
  useEffect(() => {
    loadActivities();
  }, [filter]);
  
  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await permissionAPI.getActivityLog(filter, 100);
      setActivities(response.data?.activities || []);
      setTotal(response.data?.total || 0);
    } catch (err) {
      console.error('Failed to load activity log:', err);
      setError('Failed to load activity log. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const filters = [
    { value: 'all', label: 'All', icon: '📋' },
    { value: 'approvals', label: 'Approvals', icon: '✅' },
    { value: 'high_risk', label: 'High Risk', icon: '⚠️' },
    { value: 'communications', label: 'Communications', icon: '📧' }
  ];
  
  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'transparent'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        background: 'var(--panel)',
        backdropFilter: 'saturate(120%) blur(var(--blur))',
        WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 0.5rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span>📊</span>
          Activity Log
        </h1>
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          margin: 0
        }}>
          Audit trail of all actions with approval history
        </p>
      </div>
      
      {/* Filters */}
      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}>
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '0.625rem 1rem',
              background: filter === f.value ? 'var(--panel-strong)' : 'var(--panel)',
              backdropFilter: 'saturate(120%) blur(var(--blur))',
              WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
              border: `1px solid ${filter === f.value ? 'var(--accent)' : 'var(--stroke)'}`,
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (filter !== f.value) {
                e.currentTarget.style.background = 'var(--panel-strong)';
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== f.value) {
                e.currentTarget.style.background = 'var(--panel)';
              }
            }}
          >
            <span>{f.icon}</span>
            {f.label}
          </button>
        ))}
        
        {/* Count */}
        {total > 0 && (
          <div style={{
            padding: '0.625rem 1rem',
            background: 'var(--panel)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius)',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center'
          }}>
            {total} {total === 1 ? 'entry' : 'entries'}
          </div>
        )}
      </div>
      
      {/* Error */}
      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'hsla(0, 100%, 70%, 0.15)',
          border: '1px solid hsla(0, 100%, 70%, 0.3)',
          borderRadius: 'var(--radius)',
          color: 'hsl(0, 100%, 85%)',
          fontSize: '0.875rem',
          marginBottom: '1.5rem'
        }}>
          {error}
        </div>
      )}
      
      {/* Loading */}
      {loading && (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem'
        }}>
          Loading activities...
        </div>
      )}
      
      {/* Activities */}
      {!loading && activities.length === 0 && (
        <EmptyState filter={filter} />
      )}
      
      {!loading && activities.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {activities.map((activity, index) => (
            <ActivityEntry
              key={activity.id || index}
              activity={activity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Activity Entry Component
function ActivityEntry({ activity }) {
  const {
    timestamp,
    action,
    permission_level,
    required_approval,
    approved,
    markers = [],
    is_high_risk
  } = activity;
  
  const statusIcon = required_approval
    ? (approved ? '✅' : '❌')
    : '▶️';
  
  const statusColor = required_approval
    ? (approved ? 'hsl(150, 100%, 70%)' : 'hsl(0, 100%, 70%)')
    : 'var(--text-muted)';
  
  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString()
    : 'Unknown time';
  
  return (
    <div style={{
      background: 'var(--panel)',
      backdropFilter: 'saturate(120%) blur(var(--blur))',
      WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
      border: `1px solid ${is_high_risk ? 'hsla(0, 100%, 70%, 0.3)' : 'var(--stroke)'}`,
      borderRadius: 'var(--radius)',
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      transition: 'var(--transition-normal)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        marginBottom: '0.75rem'
      }}>
        {/* Status icon */}
        <span style={{
          fontSize: '1.25rem',
          color: statusColor,
          lineHeight: 1
        }}>
          {statusIcon}
        </span>
        
        {/* Content */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '1rem',
            fontWeight: 500,
            color: 'var(--text)',
            marginBottom: '0.25rem'
          }}>
            {action}
          </div>
          
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <span>🕒 {formattedTime}</span>
            <span>🔐 {permission_level}</span>
            {required_approval && (
              <span>
                ⚠️ Approval {approved ? 'granted' : 'denied'}
              </span>
            )}
            {is_high_risk && (
              <span style={{ color: 'hsl(0, 100%, 70%)' }}>
                🚨 High Risk
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Markers */}
      {markers && markers.length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--stroke)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {markers.map((marker, i) => (
            <span
              key={i}
              style={{
                padding: '0.25rem 0.5rem',
                background: 'rgba(0, 0, 0, 0.2)',
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
      )}
    </div>
  );
}

// Empty State
function EmptyState({ filter }) {
  const messages = {
    all: 'No activities yet',
    approvals: 'No approval activities',
    high_risk: 'No high-risk activities',
    communications: 'No communication activities'
  };
  
  return (
    <div style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      background: 'var(--panel)',
      backdropFilter: 'saturate(120%) blur(var(--blur))',
      WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
      border: '1px solid var(--stroke)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        fontSize: '3rem',
        marginBottom: '1rem'
      }}>
        📋
      </div>
      <div style={{
        fontSize: '1rem',
        color: 'var(--text)',
        marginBottom: '0.5rem'
      }}>
        {messages[filter] || messages.all}
      </div>
      <div style={{
        fontSize: '0.875rem',
        color: 'var(--text-muted)'
      }}>
        Activities will appear here as you use Agent Max
      </div>
    </div>
  );
}
