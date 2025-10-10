import { Home, MessageSquare, BookOpen, Search, Settings as SettingsIcon, Sliders } from 'lucide-react';
import { cn } from '../utils/cn';
import useStore from '../store/useStore';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'conversation', label: 'Conversation', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'preferences', label: 'Preferences', icon: Sliders },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, profile, apiConnected } = useStore();

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Agent Max</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Memory System V2</p>
      </div>

      {/* Profile Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            {profile?.name ? profile.name[0].toUpperCase() : 'G'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {profile?.name || 'Guest'}
            </p>
            <div className="flex items-center space-x-1">
              <div className={cn(
                "w-2 h-2 rounded-full",
                apiConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {apiConnected ? 'Connected' : 'Disconnected'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          v1.0.0
        </p>
      </div>
    </div>
  );
}
