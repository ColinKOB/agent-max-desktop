/**
 * Notification Center Component
 * Advanced notification system with liquid glass styling
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  XCircle,
  Clock,
  Trash2,
  Archive,
  Settings
} from 'lucide-react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { formatRelativeTime } from '../../utils/formatters';

// Notification types
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SYSTEM: 'system'
};

// Type icons
const typeIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  system: Bell
};

// Type colors
const typeColors = {
  success: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  error: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  warning: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  system: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20'
};

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedType, setSelectedType] = useState(null);

  // Load notifications from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      const parsed = JSON.parse(saved);
      setNotifications(parsed);
      setUnreadCount(parsed.filter(n => !n.read).length);
    } else {
      // Demo notifications
      const demoNotifications = [
        {
          id: 1,
          type: 'success',
          title: 'Conversation completed',
          message: 'Your AI conversation was successful',
          timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 min ago
          read: false,
          actions: [
            { label: 'View', action: 'view' },
            { label: 'Share', action: 'share' }
          ]
        },
        {
          id: 2,
          type: 'warning',
          title: 'Usage limit approaching',
          message: 'You have used 80% of your monthly conversations',
          timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
          read: false,
          actions: [
            { label: 'Upgrade', action: 'upgrade' }
          ]
        },
        {
          id: 3,
          type: 'info',
          title: 'New feature available',
          message: 'Check out the new command palette (Cmd+K)',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          read: true
        }
      ];
      setNotifications(demoNotifications);
      setUnreadCount(demoNotifications.filter(n => !n.read).length);
    }
  }, []);

  // Save notifications to localStorage
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem('notifications', JSON.stringify(notifications));
    }
  }, [notifications]);

  // Add notification (exposed for external use)
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now(),
      timestamp: new Date(),
      read: false,
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    
    // Play notification sound if enabled
    if (window.notificationSound) {
      window.notificationSound.play();
    }
    
    // Show desktop notification if permitted
    if (Notification.permission === 'granted') {
      new Notification(newNotification.title, {
        body: newNotification.message,
        icon: '/logo.png'
      });
    }
  }, []);

  // Mark as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  // Delete notification
  const deleteNotification = useCallback((id) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Archive old notifications (> 7 days)
  const archiveOld = useCallback(() => {
    const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
    setNotifications(prev => prev.filter(n => n.timestamp > sevenDaysAgo));
  }, []);

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    if (selectedType) return n.type === selectedType;
    return true;
  });

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Expose methods globally
  useEffect(() => {
    window.notificationCenter = {
      add: addNotification,
      markAsRead,
      markAllAsRead,
      clear: clearAll
    };
  }, [addNotification, markAsRead, markAllAsRead, clearAll]);

  return (
    <>
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div className="fixed right-4 top-16 z-50 w-96 max-h-[600px] animate-slide-in">
            <LiquidGlassCard variant="elevated" className="flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Filters */}
                <div className="flex gap-2">
                  {['all', 'unread', 'read'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                        filter === f
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                
                {/* Type filters */}
                <div className="flex gap-2 mt-2">
                  {Object.values(NOTIFICATION_TYPES).map(type => {
                    const Icon = typeIcons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedType(selectedType === type ? null : type)}
                        className={`p-1 rounded transition-colors ${
                          selectedType === type
                            ? typeColors[type].split(' ')[1]
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        aria-label={`Filter by ${type}`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredNotifications.map(notification => {
                      const Icon = typeIcons[notification.type];
                      const colorClass = typeColors[notification.type];
                      
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                            !notification.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                          }`}
                        >
                          <div className="flex gap-3">
                            {/* Icon */}
                            <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm">
                                    {notification.title}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {notification.message}
                                  </p>
                                  
                                  {/* Actions */}
                                  {notification.actions && (
                                    <div className="flex gap-2 mt-2">
                                      {notification.actions.map((action, idx) => (
                                        <button
                                          key={idx}
                                          onClick={() => {
                                            console.log('Action:', action.action);
                                            markAsRead(notification.id);
                                          }}
                                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                                        >
                                          {action.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mt-2">
                                    <Clock className="w-3 h-3 text-gray-400" />
                                    <span className="text-xs text-gray-500">
                                      {formatRelativeTime(notification.timestamp)}
                                    </span>
                                    {!notification.read && (
                                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                                        New
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Delete button */}
                                <button
                                  onClick={() => deleteNotification(notification.id)}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button
                    onClick={archiveOld}
                    className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                  >
                    <Archive className="w-4 h-4" />
                    Archive old
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear all
                  </button>
                </div>
              )}
            </LiquidGlassCard>
          </div>
        </>
      )}
    </>
  );
}

// Hook to use notifications
export function useNotifications() {
  const addNotification = (notification) => {
    if (window.notificationCenter) {
      window.notificationCenter.add(notification);
    }
  };

  const success = (title, message, actions) => {
    addNotification({ type: 'success', title, message, actions });
  };

  const error = (title, message, actions) => {
    addNotification({ type: 'error', title, message, actions });
  };

  const warning = (title, message, actions) => {
    addNotification({ type: 'warning', title, message, actions });
  };

  const info = (title, message, actions) => {
    addNotification({ type: 'info', title, message, actions });
  };

  return { success, error, warning, info, addNotification };
}
