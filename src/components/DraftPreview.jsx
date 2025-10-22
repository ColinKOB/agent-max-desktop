/**
 * Draft Preview Component
 * 
 * Displays preview of email or post drafts
 * Used in ApprovalDialog before sending
 * 
 * Design System:
 * - Background: var(--panel) (55%)
 * - Border: var(--stroke)
 * - Text: Proper hierarchy with muted labels
 */
export default function DraftPreview({ draft, type = 'email' }) {
  if (!draft) {
    return (
      <div style={{
        padding: '1rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '0.875rem'
      }}>
        No preview available
      </div>
    );
  }
  
  if (type === 'email') {
    return (
      <EmailPreview draft={draft} />
    );
  } else if (type === 'post') {
    return (
      <PostPreview draft={draft} />
    );
  }
  
  return null;
}

// Email Preview
function EmailPreview({ draft }) {
  const { to = [], cc = [], bcc = [], subject = '', body = '', is_html = false } = draft;
  
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        backdropFilter: 'saturate(120%) blur(var(--blur))',
        WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))'
      }}
    >
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '0.75rem',
          margin: '0 0 0.75rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <span>📧</span>
        Email Draft
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {/* To */}
        <Field label="To" value={formatEmailList(to)} />
        
        {/* CC (if present) */}
        {cc && cc.length > 0 && (
          <Field label="CC" value={formatEmailList(cc)} />
        )}
        
        {/* BCC (if present) */}
        {bcc && bcc.length > 0 && (
          <Field label="BCC" value={formatEmailList(bcc)} />
        )}
        
        {/* Subject */}
        <Field label="Subject" value={subject || '(No subject)'} />
        
        {/* Body */}
        <div
          style={{
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--stroke)',
            marginTop: '0.25rem'
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            Message
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text)',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '0.5rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--stroke)'
            }}
            dangerouslySetInnerHTML={is_html ? { __html: body } : undefined}
          >
            {!is_html && body}
          </div>
          {is_html && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.5rem',
                fontStyle: 'italic'
              }}
            >
              HTML email
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Post Preview
function PostPreview({ draft }) {
  const { platform = 'Unknown', content = '', attachments = [] } = draft;
  
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--stroke)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        backdropFilter: 'saturate(120%) blur(var(--blur))',
        WebkitBackdropFilter: 'saturate(120%) blur(var(--blur))'
      }}
    >
      <h3
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: '0.75rem',
          margin: '0 0 0.75rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <span>📱</span>
        {platform} Post
      </h3>
      
      <div
        style={{
          fontSize: '0.875rem',
          color: 'var(--text)',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '0.75rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--stroke)'
        }}
      >
        {content}
      </div>
      
      {attachments && attachments.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '0.5rem'
            }}
          >
            Attachments ({attachments.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {attachments.map((file, i) => (
              <span
                key={i}
                style={{
                  padding: '0.25rem 0.5rem',
                  background: 'var(--panel)',
                  border: '1px solid var(--stroke)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)'
                }}
              >
                📎 {file}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Field component for email metadata
function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          minWidth: '60px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        {label}:
      </div>
      <div
        style={{
          fontSize: '0.875rem',
          color: 'var(--text)',
          flex: 1,
          wordBreak: 'break-word'
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Helper to format email lists
function formatEmailList(emails) {
  if (!emails || emails.length === 0) return '';
  return emails.join(', ');
}
