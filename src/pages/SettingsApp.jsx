import { useState, useEffect } from 'react';
import SettingsSimple from './SettingsSimple.jsx';
import { BillingSettings } from '../components/billing/BillingSettings.jsx';
import ConversationHistory from '../components/ConversationHistory.jsx';
import DeepDiveTab from '../components/settings/DeepDiveTab.jsx';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');
  const [selectedDeepDiveId, setSelectedDeepDiveId] = useState(null);

  // Check URL for deep dive navigation (works with both hash and search params)
  useEffect(() => {
    const parseDeepDiveId = () => {
      // Check hash first (HashRouter style: #/settings?deepdive=ID)
      const hash = window.location.hash;
      if (hash.includes('deepdive=')) {
        const match = hash.match(/deepdive=([^&]+)/);
        if (match) return match[1];
      }
      // Also check search params (direct URL style: /settings?deepdive=ID)
      const search = window.location.search;
      if (search.includes('deepdive=')) {
        const match = search.match(/deepdive=([^&]+)/);
        if (match) return match[1];
      }
      return null;
    };

    const handleNavigation = () => {
      const deepDiveId = parseDeepDiveId();
      if (deepDiveId) {
        console.log('[Settings] Navigating to Deep Dive:', deepDiveId);
        setSelectedDeepDiveId(deepDiveId);
        setActiveTab('deepdive');
      }
    };

    // Check on mount
    handleNavigation();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    
    return () => {
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  const tabs = [
    { id: 'settings', label: 'Settings' },
    { id: 'billing', label: 'Billing' },
    { id: 'deepdive', label: 'Deep Dive' },
    { id: 'history', label: 'History' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <SettingsSimple />;
      case 'billing':
        return (
          <div style={{ minHeight: '100%', padding: '24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <BillingSettings />
            </div>
          </div>
        );
      case 'history':
        return (
          <div style={{ minHeight: '100%', padding: '24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16, color: 'rgba(255,255,255,0.95)' }}>History</h1>
              <div style={{
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)',
                borderRadius: 12,
                padding: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}>
                <ConversationHistory onLoadConversation={() => {}} />
              </div>
            </div>
          </div>
        );
      case 'deepdive':
        return (
          <DeepDiveTab 
            selectedDeepDiveId={selectedDeepDiveId}
            onClose={() => {
              setSelectedDeepDiveId(null);
              // Navigate back to main chat if opened from there
              if (window.opener || window.electronAPI) {
                window.close();
              }
            }}
          />
        );
      default:
        return <SettingsSimple />;
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(26,26,31,0.95) 0%, rgba(18,18,22,0.95) 100%)',
      color: 'rgba(255,255,255,0.95)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.16)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'rgba(255,255,255,0.95)' }}>Agent Max</h1>

          {/* Tabs */}
          <nav aria-label="Settings navigation">
            <ul style={{ display: 'flex', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
              {tabs.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setActiveTab(t.id)}
                    aria-current={activeTab === t.id ? 'page' : undefined}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: activeTab === t.id ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.12)',
                      background: activeTab === t.id
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.10) 100%)'
                        : 'rgba(255,255,255,0.05)',
                      color: activeTab === t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: activeTab === t.id
                        ? '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                        : 'none',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== t.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== t.id) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      }
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
      <main style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '24px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent'
      }}>{renderContent()}</main>
    </div>
  );
}