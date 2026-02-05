import { useState, useEffect } from 'react';
import SettingsSimple from './SettingsSimple.jsx';
import { BillingSettings } from '../components/billing/BillingSettings.jsx';
import ConversationHistory from '../components/ConversationHistory.jsx';
import { WorkspaceActivityLog } from '../components/workspace/WorkspaceActivityLog.tsx';
import logo from '../assets/AgentMaxLogo.png';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');

  // Check URL for navigation (section param)
  useEffect(() => {
    const parseSection = () => {
      // Check hash first (HashRouter style: #/settings?section=billing)
      const hash = window.location.hash;
      if (hash.includes('section=')) {
        const match = hash.match(/section=([^&]+)/);
        if (match) return match[1];
      }
      // Also check search params
      const search = window.location.search;
      if (search.includes('section=')) {
        const match = search.match(/section=([^&]+)/);
        if (match) return match[1];
      }
      return null;
    };

    const handleNavigation = () => {
      // Check for section param (billing, settings, history, etc.)
      const section = parseSection();
      if (section) {
        // Map 'credits' to 'billing' for backwards compatibility
        const tabId = section === 'credits' ? 'billing' : section;
        const validTabs = ['settings', 'billing', 'history', 'activity'];
        if (validTabs.includes(tabId)) {
          console.log('[Settings] Navigating to section:', tabId);
          setActiveTab(tabId);
          return;
        }
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
    { id: 'history', label: 'History' },
    { id: 'activity', label: "Max's Activity", icon: '🤖' },
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
          <div style={{ height: 'calc(100vh - 80px)', padding: '16px 24px 24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto', height: '100%' }}>
              <ConversationHistory onLoadConversation={() => {}} />
            </div>
          </div>
        );
      case 'activity':
        return (
          <div style={{ minHeight: '100%', padding: '24px' }}>
            <div style={{ maxWidth: 900, margin: '0 auto', height: 'calc(100vh - 140px)' }}>
              <WorkspaceActivityLog
                maxEntries={200}
                autoRefresh={true}
                refreshInterval={3000}
              />
            </div>
          </div>
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        WebkitAppRegion: 'drag',
        paddingTop: 8,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src={logo}
              alt="Agent Max"
              style={{
                height: 24,
                width: 24,
                filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3))'
              }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'rgba(255,255,255,0.95)' }}>Agent Max</h1>
          </div>

          {/* Tabs */}
          <nav aria-label="Settings navigation" style={{ WebkitAppRegion: 'no-drag' }}>
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
                    {t.icon && <span style={{ marginRight: 4 }}>{t.icon}</span>}
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
