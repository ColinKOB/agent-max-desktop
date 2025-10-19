/**
 * Command Palette Component
 * 
 * Universal command interface for quick access to all features
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Search,
  Settings,
  DollarSign,
  MessageSquare,
  FileText,
  HelpCircle,
  History,
  User,
  CreditCard,
  Activity,
  LogOut,
  Moon,
  Sun,
  Command,
  ArrowRight,
  Sparkles,
  Zap,
  Mail,
  Globe,
  Database,
  Terminal
} from 'lucide-react';

const COMMAND_GROUPS = {
  QUICK_ACTIONS: 'Quick Actions',
  NAVIGATION: 'Navigation',
  BILLING: 'Billing & Usage',
  SETTINGS: 'Settings',
  HELP: 'Help & Support',
  RECENT: 'Recent'
};

const COMMANDS = [
  // Quick Actions
  {
    id: 'new-conversation',
    label: 'Start New Conversation',
    icon: MessageSquare,
    group: COMMAND_GROUPS.QUICK_ACTIONS,
    shortcut: ['⌘', 'N'],
    action: () => window.location.href = '/conversation/new',
    keywords: ['chat', 'talk', 'begin', 'create']
  },
  {
    id: 'quick-goal',
    label: 'Quick Goal',
    icon: Zap,
    group: COMMAND_GROUPS.QUICK_ACTIONS,
    shortcut: ['⌘', 'G'],
    action: () => window.location.href = '/quick-goal',
    keywords: ['fast', 'quick', 'goal', 'task']
  },
  {
    id: 'email-check',
    label: 'Check Email',
    icon: Mail,
    group: COMMAND_GROUPS.QUICK_ACTIONS,
    action: () => window.location.href = '/tools/email',
    keywords: ['mail', 'inbox', 'messages']
  },
  {
    id: 'browser-automation',
    label: 'Browser Automation',
    icon: Globe,
    group: COMMAND_GROUPS.QUICK_ACTIONS,
    action: () => window.location.href = '/tools/browser',
    keywords: ['web', 'automate', 'scrape']
  },
  
  // Navigation
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Activity,
    group: COMMAND_GROUPS.NAVIGATION,
    shortcut: ['⌘', 'D'],
    action: () => window.location.href = '/dashboard',
    keywords: ['home', 'overview', 'main']
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: MessageSquare,
    group: COMMAND_GROUPS.NAVIGATION,
    shortcut: ['⌘', '1'],
    action: () => window.location.href = '/conversations',
    keywords: ['history', 'chat', 'messages']
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    group: COMMAND_GROUPS.NAVIGATION,
    shortcut: ['⌘', ','],
    action: () => window.location.href = '/settings',
    keywords: ['preferences', 'config', 'options']
  },
  
  // Billing
  {
    id: 'billing-dashboard',
    label: 'Billing Dashboard',
    icon: DollarSign,
    group: COMMAND_GROUPS.BILLING,
    action: () => window.location.href = '/billing',
    keywords: ['payment', 'subscription', 'cost', 'usage']
  },
  {
    id: 'invoices',
    label: 'View Invoices',
    icon: FileText,
    group: COMMAND_GROUPS.BILLING,
    action: () => window.location.href = '/billing/invoices',
    keywords: ['receipts', 'bills', 'statements']
  },
  {
    id: 'upgrade',
    label: 'Upgrade Plan',
    icon: Sparkles,
    group: COMMAND_GROUPS.BILLING,
    action: () => window.open('https://agentmax.dev/upgrade', '_blank'),
    keywords: ['pro', 'premium', 'subscribe']
  },
  {
    id: 'update-payment',
    label: 'Update Payment Method',
    icon: CreditCard,
    group: COMMAND_GROUPS.BILLING,
    action: () => window.location.href = '/settings/billing',
    keywords: ['card', 'credit', 'payment']
  },
  
  // Settings
  {
    id: 'profile',
    label: 'Profile Settings',
    icon: User,
    group: COMMAND_GROUPS.SETTINGS,
    action: () => window.location.href = '/settings/profile',
    keywords: ['account', 'user', 'personal']
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Dark Mode',
    icon: Moon,
    group: COMMAND_GROUPS.SETTINGS,
    shortcut: ['⌘', 'T'],
    action: () => toggleTheme(),
    keywords: ['dark', 'light', 'theme', 'appearance']
  },
  {
    id: 'api-settings',
    label: 'API Settings',
    icon: Terminal,
    group: COMMAND_GROUPS.SETTINGS,
    action: () => window.location.href = '/settings/api',
    keywords: ['developer', 'api', 'keys', 'tokens']
  },
  {
    id: 'database-connections',
    label: 'Database Connections',
    icon: Database,
    group: COMMAND_GROUPS.SETTINGS,
    action: () => window.location.href = '/settings/databases',
    keywords: ['sql', 'postgres', 'mysql', 'mongo']
  },
  
  // Help
  {
    id: 'help',
    label: 'Help Center',
    icon: HelpCircle,
    group: COMMAND_GROUPS.HELP,
    shortcut: ['⌘', '?'],
    action: () => window.open('https://agentmax.dev/help', '_blank'),
    keywords: ['support', 'docs', 'documentation', 'guide']
  },
  {
    id: 'keyboard-shortcuts',
    label: 'Keyboard Shortcuts',
    icon: Command,
    group: COMMAND_GROUPS.HELP,
    shortcut: ['⌘', 'K', 'K'],
    action: () => showKeyboardShortcuts(),
    keywords: ['hotkeys', 'shortcuts', 'keys']
  },
  {
    id: 'logout',
    label: 'Log Out',
    icon: LogOut,
    group: COMMAND_GROUPS.SETTINGS,
    action: () => handleLogout(),
    keywords: ['sign out', 'exit', 'leave']
  }
];

// Helper functions for actions
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function showKeyboardShortcuts() {
  // This would open a modal showing all keyboard shortcuts
  console.log('Show keyboard shortcuts modal');
}

function handleLogout() {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.clear();
    window.location.href = '/login';
  }
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState([]);

  // Load recent commands from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recent_commands');
    if (saved) {
      setRecentCommands(JSON.parse(saved).slice(0, 3));
    }
  }, []);

  // Register keyboard shortcuts
  useHotkeys('cmd+k, ctrl+k', (e) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  }, { enableOnFormTags: true });

  useHotkeys('escape', () => {
    if (isOpen) {
      setIsOpen(false);
      setSearch('');
      setSelectedIndex(0);
    }
  }, { enabled: isOpen });

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) {
      // Show recent commands when no search
      const recentCmds = recentCommands
        .map(id => COMMANDS.find(c => c.id === id))
        .filter(Boolean)
        .map(cmd => ({ ...cmd, group: COMMAND_GROUPS.RECENT }));
      
      return [...recentCmds, ...COMMANDS];
    }

    const searchLower = search.toLowerCase();
    return COMMANDS.filter(cmd => 
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.keywords?.some(keyword => keyword.toLowerCase().includes(searchLower))
    );
  }, [search, recentCommands]);

  // Group commands
  const groupedCommands = useMemo(() => {
    const groups = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Handle command execution
  const executeCommand = useCallback((command) => {
    // Save to recent commands
    const recent = [command.id, ...recentCommands.filter(id => id !== command.id)].slice(0, 5);
    setRecentCommands(recent);
    localStorage.setItem('recent_commands', JSON.stringify(recent));

    // Execute the command
    command.action();
    
    // Close palette
    setIsOpen(false);
    setSearch('');
    setSelectedIndex(0);
  }, [recentCommands]);

  // Keyboard navigation
  useHotkeys('up', () => {
    if (isOpen && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }, { enabled: isOpen });

  useHotkeys('down', () => {
    if (isOpen && selectedIndex < filteredCommands.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, { enabled: isOpen });

  useHotkeys('enter', () => {
    if (isOpen && filteredCommands[selectedIndex]) {
      executeCommand(filteredCommands[selectedIndex]);
    }
  }, { enabled: isOpen });

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Command Palette */}
      <div className="fixed inset-x-0 top-20 mx-auto max-w-2xl z-50 animate-slide-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command or search..."
                className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none text-lg"
                autoFocus
              />
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                ESC
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No commands found for "{search}"
              </div>
            ) : (
              <div className="p-2">
                {Object.entries(groupedCommands).map(([group, commands]) => (
                  <div key={group} className="mb-4">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {group}
                    </div>
                    {commands.map((cmd, idx) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const Icon = cmd.icon;
                      const isSelected = globalIndex === selectedIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => executeCommand(cmd)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                            ${isSelected 
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
                          `}
                        >
                          <Icon className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1 text-left">{cmd.label}</span>
                          
                          {cmd.shortcut && (
                            <div className="flex items-center gap-1">
                              {cmd.shortcut.map((key, keyIdx) => (
                                <kbd
                                  key={keyIdx}
                                  className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                                >
                                  {key}
                                </kbd>
                              ))}
                            </div>
                          )}
                          
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">ESC</kbd>
                Close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              Command Palette
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
