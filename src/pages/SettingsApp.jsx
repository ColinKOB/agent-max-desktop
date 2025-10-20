import { useState } from 'react';
import { Settings as SettingsIcon, History, X } from 'lucide-react';
import toast from 'react-hot-toast';
import SettingsGlass from './SettingsGlass';
import ConversationHistory from '../components/ConversationHistory';
import '../styles/settings-glass.css';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings', icon: SettingsIcon, component: SettingsGlass },
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
        <div className="amx-liquid amx-noise amx-p-panel mx-4 mt-4 mb-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="amx-heading text-lg">Agent Max Settings</h1>

            <div className="flex gap-2 ml-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      activeTab === tab.id
                        ? 'bg-white/15 border-white/25 text-white'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
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
