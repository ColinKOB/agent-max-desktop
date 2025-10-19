import { useState } from 'react';
import { Settings as SettingsIcon, History, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Settings from './Settings';
import SettingsPremium from './SettingsPremium';
import ConversationHistory from '../components/ConversationHistory';

export default function SettingsApp() {
  const [activeTab, setActiveTab] = useState('settings');

  const tabs = [
    { id: 'settings', label: 'Settings', icon: SettingsIcon, component: SettingsPremium },
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
      <div id="backdrop"></div>
      <div className="main-ui h-screen flex flex-col bg-gray-950">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-100">Agent Max Settings</h1>

          <div className="flex gap-2 ml-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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
          className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-200 transition-colors"
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
            <div className="max-w-5xl mx-auto">
              <ActiveComponent />
            </div>
          ))}
      </div>
      </div>
    </>
  );
}
