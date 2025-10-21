import { useState } from 'react';
import { Settings as SettingsIcon, History, X } from 'lucide-react';
import toast from 'react-hot-toast';
import SettingsEnhanced from './SettingsEnhanced';
import ConversationHistory from '../components/ConversationHistory';
import '../styles/settings-glass.css';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings', icon: SettingsIcon, component: SettingsEnhanced },
    { id: 'history', label: 'History', icon: History, component: ConversationHistory },
  ];

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component;

  const handleClose = () => {
    if (window.electronAPI) {
      window.close();
    }
  };

  return (
    <>
      <div className="settings-scope">
        <div id="backdrop"></div>
        <div className="main-ui h-screen flex flex-col bg-transparent">
        {/* Header */}
        <div className="amx-liquid amx-noise amx-p-panel mx-4 mt-4 mb-2 flex flex-col gap-3 flex-shrink-0">
          {/* Title row */}
          <div className="flex items-center justify-between min-w-0">
            <h1 className="amx-heading text-lg">Agent Max Settings</h1>

            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs row */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-3 min-w-max items-center" role="tablist" aria-label="Settings sections">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 border whitespace-nowrap ${
                      selected
                        ? 'bg-white/45 border-white/40 text-black shadow-lg'
                        : 'bg-white/35 hover:bg-white/40 border-white/25 hover:border-white/30 text-black/90'
                    }`}
                    style={{
                      backdropFilter: selected ? 'blur(12px) saturate(160%)' : 'blur(10px)',
                      WebkitBackdropFilter: selected ? 'blur(12px) saturate(160%)' : 'blur(10px)',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {ActiveComponent &&
          (activeTab === 'history' ? (
            <div className="h-full">
              <ActiveComponent
                onLoadConversation={(conv) => {
                  // In Settings window, we can't load into FloatBar
                  // Just show a toast notification
                  toast('💡 Open the main window to continue this conversation', {
                    duration: 4000,
                  });
                }}
              />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <ActiveComponent />
            </div>
          ))}
      </div>
        </div>
      </div>
    </>
  );
}
