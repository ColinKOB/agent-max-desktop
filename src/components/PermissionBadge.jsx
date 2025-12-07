/**
 * Permission Badge Component
 * 
 * Displays current permission level in header with glass morphism styling
 * Shows icon and level name, clickable to open settings
 * 
 * Design System:
 * - Background: var(--panel) with backdrop blur
 * - Hover: var(--panel-strong)
 * - Border: var(--stroke)
 * - Transition: 120ms ease-out (fast)
 */
import { useState } from 'react';

export default function PermissionBadge({ level = 'chatty', onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  const badges = {
    chatty: { icon: '💬', label: 'Chatty', color: 'hsl(220, 100%, 70%)' },
    autonomous: { icon: '🤖', label: 'Autonomous', color: 'hsl(280, 100%, 70%)' }
  };

  const badge = badges[level] || badges.chatty;
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-sm)', // 8px
        background: isHovered ? 'var(--panel-strong)' : 'var(--panel)',
        backdropFilter: 'saturate(120%) blur(var(--blur))',
        WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))',
        border: '1px solid var(--stroke)',
        color: 'var(--text)',
        fontSize: '0.875rem',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        transition: 'var(--transition-fast)', // 120ms
        boxShadow: isHovered
          ? '0 4px 12px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        outline: 'none'
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = isHovered
          ? '0 4px 12px rgba(0, 0, 0, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)';
      }}
      aria-label={`Current permission level: ${badge.label}`}
      title={`Click to change permission level (Currently: ${badge.label})`}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{badge.icon}</span>
      <span>{badge.label}</span>
      <span style={{ 
        fontSize: '0.75rem', 
        color: 'var(--text-muted)',
        transition: 'transform 0.12s ease-out',
        transform: isHovered ? 'translateY(1px)' : 'translateY(0)'
      }}>
        ▼
      </span>
    </button>
  );
}
