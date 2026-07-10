import { Bot, CheckCircle2, ShieldCheck } from 'lucide-react';

const CAPABILITIES = [
  'Answer questions and research',
  'Write and modify files',
  'Run code and multi-step tasks',
  'Control approved desktop tools',
];

const APPROVALS = [
  'Communications',
  'Package installation',
  'Deletion and deployment',
  'Financial operations',
];

export default function PermissionLevelSelector({ loading }) {
  return (
    <div className="permission-level-selector" style={{ width: '100%' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 500, margin: 0, color: 'var(--text)' }}>
        Execution permissions
      </h3>
      <p
        style={{
          fontSize: '0.875rem',
          margin: '0.25rem 0 1rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Max uses autonomous execution for every request. Sensitive actions still require approval.
      </p>

      <div
        aria-busy={loading || undefined}
        style={{
          padding: '1rem',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--stroke)',
          background: 'var(--panel)',
          opacity: loading ? 0.65 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <Bot size={20} aria-hidden="true" />
          <div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>Auto is active</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Full task execution with approval gates
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {CAPABILITIES.map((capability) => (
            <div key={capability} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={15} color="var(--success, #22c55e)" aria-hidden="true" />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{capability}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.875rem',
            paddingTop: '0.875rem',
            borderTop: '1px solid var(--stroke)',
          }}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.45 }}>
            Approval required for: {APPROVALS.join(', ')}.
          </span>
        </div>
      </div>
    </div>
  );
}
