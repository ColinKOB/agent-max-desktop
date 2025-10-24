import { useEffect, useState } from 'react';
import { SubscriptionManager } from '../components/SubscriptionManager';

export default function BillingSimple() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('billing_email');
      if (stored) setEmail(stored);
    } catch {}
  }, []);

  return (
    <div style={{ background: '#f9fafb', color: '#111827', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 16 }}>Billing</h1>

        <section role="region" aria-label="Billing and subscription" style={{ border: '1px solid #d1d5db', background: '#ffffff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 14, color: '#374151', marginBottom: 16, lineHeight: 1.5 }}>
            Manage your plan, payment method, and invoices.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <SubscriptionManager customerEmail={email} />
          </div>
        </section>
      </div>
    </div>
  );
}
