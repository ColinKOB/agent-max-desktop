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
    <div style={{ background: '#fff', color: '#111827', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Billing</h1>

        <section style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 16 }}>
            Manage your plan, payment method, and invoices.
          </p>
          <SubscriptionManager customerEmail={email} />
        </section>
      </div>
    </div>
  );
}
