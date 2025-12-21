import { useState, useEffect } from 'react';
import { GoogleConnect } from '../components/GoogleConnect';
import { isGoogleComingSoon } from '../config/featureGates';

export function GoogleSetup() {
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    try {
      const email = localStorage.getItem('user_email');
      if (email) setUserEmail(email);
    } catch {}
  }, []);

  // Show "Coming Soon" for non-beta users
  if (isGoogleComingSoon(userEmail)) {
    return (
      <div className="google-setup-page" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 24,
        background: 'linear-gradient(135deg, #1a1a1f 0%, #0d0d10 100%)'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          maxWidth: 400
        }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(251, 146, 60, 0.2)',
              color: 'rgb(251, 146, 60)',
              padding: '6px 12px',
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 600
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Coming Soon
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: 12 }}>
            Google Integration
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>
            Connect your Google account to unlock powerful integrations with Gmail, Calendar, Docs, Sheets, and YouTube.
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8
          }}>
            {['Gmail', 'Calendar', 'Docs', 'Sheets', 'YouTube'].map((service) => (
              <span key={service} style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.7)',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13
              }}>
                {service}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="google-setup-page">
      <GoogleConnect />
    </div>
  );
}
