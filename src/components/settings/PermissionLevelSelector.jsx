/**
 * Permission Level Selector Component
 *
 * Allows users to select their permission level (Chatty or Autonomous)
 * with glass morphism design following GLASS_DESIGN_SYSTEM.md
 *
 * ONLY TWO VALID MODES:
 * - 'chatty': Read-only assistant mode
 * - 'autonomous': Full autonomous execution mode
 *
 * Design System:
 * - Panel opacity: 55% (var(--panel))
 * - Selected: 82% (var(--panel-strong))
 * - Border: hairline 6% white (var(--stroke))
 * - Blur: 18px (var(--blur))
 * - Transition: 180ms ease-out
 */
import { useState, useEffect } from 'react';

export default function PermissionLevelSelector({ currentLevel, onChange, loading }) {
  // Default to 'chatty' - the only valid levels are 'chatty' and 'autonomous'
  const [selected, setSelected] = useState(currentLevel || 'chatty');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Permission Levels - Only TWO levels are supported:
   * - chatty: Default conversational mode (read-only)
   * - autonomous: Full autonomous capabilities
   */
  const levels = [
    {
      value: 'chatty',
      icon: '💬',
      name: 'Chatty (Default)',
      description: 'Conversational assistant with read access',
      capabilities: [
        'Chat and answer questions',
        'Read files and documentation',
        'Read emails, calendar, contacts (Google)',
        'Search and research'
      ],
      approvals: ['Financial operations']
    },
    {
      value: 'autonomous',  // NOTE: value must stay 'autonomous' - only display name changes
      icon: '🤖',
      name: 'Auto (Full Access)',
      description: 'Full autonomous capabilities with multi-step execution',
      capabilities: [
        'Everything in Chatty mode',
        'Write and modify files',
        'Run scripts and execute code',
        'Control desktop (windows, apps)',
        'Download files',
        'Multi-step autonomous execution',
        'Screenshot context on every request'
      ],
      approvals: [
        'Send emails & messages',
        'Install packages',
        'Delete operations',
        'Deploy to production',
        'Financial operations'
      ]
    }
  ];
  
  const handleChange = async (level) => {
    if (saving) return;

    setSelected(level);
    setSaving(true);
    setError(null);

    try {
      // Let the parent (PermissionContext) handle the API call and state management
      if (onChange) {
        await onChange(level);
      }
    } catch (err) {
      console.error('Failed to update permission level:', err);
      setError('Failed to update permission level. Please try again.');
      // Revert selection on error
      setSelected(currentLevel || 'chatty');
    } finally {
      setSaving(false);
    }
  };
  
  // Update local state if parent changes currentLevel
  useEffect(() => {
    if (currentLevel) {
      setSelected(currentLevel);
    }
  }, [currentLevel]);
  
  return (
    <div className="permission-level-selector" style={{ width: '100%' }}>
      {/* Header */}
      <h3 style={{ 
        fontSize: '1.125rem', 
        fontWeight: 500, 
        marginBottom: '0.5rem',
        color: 'var(--text)',
        margin: 0
      }}>
        Permission Level
      </h3>
      <p style={{ 
        fontSize: '0.875rem', 
        marginBottom: '1rem',
        marginTop: '0.25rem',
        color: 'var(--text-muted)',
        lineHeight: '1.5'
      }}>
        Choose how much autonomy Agent Max has
      </p>
      
      {/* Error message */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: 'hsla(0, 100%, 70%, 0.15)',
          border: '1px solid hsla(0, 100%, 70%, 0.3)',
          borderRadius: 'var(--radius)',
          color: 'hsl(0, 100%, 85%)',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}
      
      {/* Level options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {levels.map((level) => {
          const isSelected = selected === level.value;
          
          return (
            <button
              key={level.value}
              onClick={() => handleChange(level.value)}
              disabled={saving || loading}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: 'var(--radius)', // 12px
                textAlign: 'left',
                transition: 'var(--transition-normal)', // 180ms
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--stroke)'}`,
                background: isSelected 
                  ? 'var(--panel-strong)' // 82% opacity
                  : 'var(--panel)', // 55% opacity
                backdropFilter: 'saturate(120%) blur(var(--blur))',
                WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
                boxShadow: isSelected
                  ? '0 8px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
                  : '0 4px 12px rgba(0, 0, 0, 0.15)',
                cursor: saving || loading ? 'wait' : 'pointer',
                opacity: saving || loading ? 0.7 : 1,
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !saving && !loading) {
                  e.currentTarget.style.background = 'hsla(220, 14%, 18%, 0.65)';
                  e.currentTarget.style.borderColor = 'hsla(0, 0%, 100%, 0.12)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--panel)';
                  e.currentTarget.style.borderColor = 'var(--stroke)';
                }
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                {/* Icon */}
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{level.icon}</span>
                
                {/* Content */}
                <div style={{ flex: 1 }}>
                  {/* Header with radio */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <h4 style={{ 
                      fontWeight: 500, 
                      color: 'var(--text)',
                      margin: 0,
                      fontSize: '1rem'
                    }}>
                      {level.name}
                    </h4>
                    
                    {/* Radio indicator */}
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--stroke)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s ease-out',
                      flexShrink: 0
                    }}>
                      {isSelected && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--bg)'
                        }} />
                      )}
                    </div>
                  </div>
                  
                  {/* Description */}
                  <p style={{ 
                    fontSize: '0.875rem', 
                    marginTop: '0.25rem',
                    marginBottom: '0.75rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.4',
                    margin: '0 0 0.75rem 0'
                  }}>
                    {level.description}
                  </p>
                  
                  {/* Capabilities */}
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.375rem' 
                  }}>
                    {level.capabilities.map((cap, i) => (
                      <div key={i} style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        <span style={{ 
                          color: 'var(--accent)',
                          fontSize: '0.875rem'
                        }}>
                          ✓
                        </span> 
                        {cap}
                      </div>
                    ))}
                    
                    {/* Approval requirements */}
                    {level.approvals && level.approvals.length > 0 && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'hsl(45, 100%, 70%)', 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                        lineHeight: '1.4'
                      }}>
                        <span style={{ flexShrink: 0 }}>⚠️</span> 
                        <span>
                          Approval for: {level.approvals.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Saving indicator */}
              {saving && selected === level.value && (
                <div style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  fontWeight: 500
                }}>
                  Saving...
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {/* Loading overlay */}
      {loading && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-muted)'
        }}>
          Loading permission settings...
        </div>
      )}
    </div>
  );
}
