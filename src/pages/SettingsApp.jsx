import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SettingsSimple from './SettingsSimple.jsx';
import { BillingSettings } from '../components/billing/BillingSettings.jsx';
import ConversationHistory from '../components/ConversationHistory.jsx';
import { WorkspaceActivityLog } from '../components/workspace/WorkspaceActivityLog.tsx';
import logo from '../assets/AgentMaxLogo.png';

const FIGTREE = 'Figtree, system-ui, -apple-system, sans-serif';

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
    { id: 'activity', label: "Max's Activity" },
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
      background: '#141418',
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
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.04)',
        WebkitAppRegion: 'drag',
        paddingTop: 8,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src={logo}
              alt="Agent Max"
              style={{
                height: 26,
                width: 26,
              }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'rgba(255,255,255,0.95)', fontFamily: FIGTREE }}>Agent Max</h1>
          </div>

          {/* Tabs */}
          <nav aria-label="Settings navigation" style={{ WebkitAppRegion: 'no-drag' }}>
            <ul style={{ display: 'flex', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
              {tabs.map((t) => (
                <li key={t.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setActiveTab(t.id)}
                    aria-current={activeTab === t.id ? 'page' : undefined}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 0,
                      border: 'none',
                      background: 'transparent',
                      color: activeTab === t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      fontFamily: FIGTREE,
                      boxShadow: 'none',
                      transition: 'color 0.15s ease, background 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== t.id) {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== t.id) {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                      }
                    }}
                  >
                    {t.label}
                  </button>
                  {activeTab === t.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      style={{
                        position: 'absolute',
                        bottom: -1,
                        left: 8,
                        right: 8,
                        height: 2,
                        background: '#e8853b',
                        borderRadius: 1,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
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
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
