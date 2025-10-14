import { useState } from 'react';
import { Monitor, Users, X } from 'lucide-react';
import ScreenControl from '../components/ScreenControl';
import AgentDashboard from '../components/AgentDashboard';

export default function ToolsPanel({ onClose, onLoadConversation }) {
  const [activeTab, setActiveTab] = useState('screen');

  const tabs = [
    { id: 'screen', label: 'Screen Control', icon: Monitor, component: ScreenControl },
    { id: 'agents', label: 'AI Agents', icon: Users, component: AgentDashboard },
  ];

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex gap-1 flex-nowrap">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  );
}
