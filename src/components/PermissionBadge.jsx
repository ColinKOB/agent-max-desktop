import { useState } from 'react';
import { Bot } from 'lucide-react';

export default function PermissionBadge({ onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-sm)',
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
        cursor: onClick ? 'pointer' : 'default',
        transition: 'var(--transition-fast)',
      }}
      aria-label="Autonomous execution is active"
      title="Autonomous execution is active"
    >
      <Bot size={16} aria-hidden="true" />
      <span>Auto</span>
    </button>
  );
}
