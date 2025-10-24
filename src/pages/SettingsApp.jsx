import { useState } from 'react';
import SettingsSimple from './SettingsSimple.jsx';
import BillingSimple from './BillingSimple.jsx';
import ConversationHistory from '../components/ConversationHistory.jsx';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'billing', label: 'Billing' },
    { id: 'history', label: 'History' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <SettingsSimple />;
      case 'billing':
        return <BillingSimple />;
      case 'history':
        return (
          <div style={{ background: '#fff', minHeight: '100%', padding: '24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>History</h1>
              <div style={{ border: '1px solid #e5e7eb', background: '#ffffff', borderRadius: 12, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <ConversationHistory onLoadConversation={() => {}} />
              </div>
            </div>
          </div>
        );
      default:
        return <SettingsSimple />;
    }
  };

  return (
    <div style={{ background: '#fff', color: '#111827', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Agent Max</h1>

          {/* Tabs */}
          <nav aria-label="Settings navigation">
            <ul style={{ display: 'flex', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
              {tabs.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTab(t.id)}
                    aria-current={activeTab === t.id ? 'page' : undefined}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: activeTab === t.id ? '1px solid #111827' : '1px solid #e5e7eb',
                      background: activeTab === t.id ? '#111827' : '#fff',
                      color: activeTab === t.id ? '#fff' : '#111827',
                      cursor: 'pointer',
                      fontWeight: 600,
                      boxShadow: activeTab === t.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '24px' }}>{renderContent()}</main>
    </div>
  );
}