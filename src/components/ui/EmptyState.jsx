/**
 * Empty State Component
 * 
 * Provides informative and actionable empty states for various scenarios
 */
import React from 'react';
import { 
  Inbox, 
  Search, 
  FileText, 
  MessageSquare, 
  FolderOpen,
  Users,
  Calendar,
  DollarSign,
  Activity,
  Settings,
  Plus
} from 'lucide-react';

const iconMap = {
  inbox: Inbox,
  search: Search,
  file: FileText,
  message: MessageSquare,
  folder: FolderOpen,
  users: Users,
  calendar: Calendar,
  dollar: DollarSign,
  activity: Activity,
  settings: Settings,
  plus: Plus
};

export function EmptyState({
  icon = 'inbox',
  emoji,
  title = 'No items found',
  description = 'There are no items to display at this time.',
  action,
  secondaryAction,
  size = 'medium',
  className = ''
}) {
  const Icon = typeof icon === 'string' ? iconMap[icon] || Inbox : icon;
  
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return {
          container: 'py-8 px-4',
          iconSize: 'w-12 h-12',
          emojiSize: 'text-4xl',
          titleSize: 'text-lg',
          descSize: 'text-sm'
        };
      case 'large':
        return {
          container: 'py-16 px-8',
          iconSize: 'w-20 h-20',
          emojiSize: 'text-7xl',
          titleSize: 'text-2xl',
          descSize: 'text-base'
        };
      default:
        return {
          container: 'py-12 px-6',
          iconSize: 'w-16 h-16',
          emojiSize: 'text-6xl',
          titleSize: 'text-xl',
          descSize: 'text-sm'
        };
    }
  };

  const sizes = getSizeClasses();

  return (
    <div className={`empty-state text-center ${sizes.container} ${className}`}>
      {/* Icon or Emoji */}
      <div className="flex justify-center mb-4">
        {emoji ? (
          <span className={sizes.emojiSize}>{emoji}</span>
        ) : (
          <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full">
            <Icon className={`${sizes.iconSize} text-gray-400 dark:text-gray-500`} />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className={`${sizes.titleSize} font-semibold text-gray-900 dark:text-gray-100 mb-2`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`${sizes.descSize} text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto`}>
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/**
 * Preset Empty States
 */

export function NoConversationsEmpty({ onStart }) {
  return (
    <EmptyState
      emoji="💬"
      title="No conversations yet"
      description="Start your first conversation to see it here. Agent Max is ready to help!"
      action={
        <button
          onClick={onStart}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Start Conversation
        </button>
      }
    />
  );
}

export function NoInvoicesEmpty() {
  return (
    <EmptyState
      emoji="📄"
      title="No invoices yet"
      description="Your invoices will appear here at the end of each billing period."
      action={
        <button
          onClick={() => window.location.href = '/pricing'}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          View Pricing
        </button>
      }
    />
  );
}

export function NoSearchResultsEmpty({ searchTerm, onClear }) {
  return (
    <EmptyState
      emoji="🔍"
      title="No results found"
      description={searchTerm ? `No results for "${searchTerm}". Try adjusting your search.` : "Try adjusting your search terms"}
      action={
        onClear && (
          <button
            onClick={onClear}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Clear Search
          </button>
        )
      }
    />
  );
}

// Alias for backward compatibility
export function NoResultsEmpty({ onReset }) {
  return (
    <EmptyState
      emoji="🔍"
      title="No results found"
      description="No items match your criteria. Try adjusting your filters or search terms."
      action={
        onReset && (
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Reset Filters
          </button>
        )
      }
    />
  );
}

export function NoDataEmpty({ dataType = 'data' }) {
  return (
    <EmptyState
      emoji="📊"
      title={`No ${dataType} available`}
      description={`${dataType} will appear here once available. Check back later.`}
    />
  );
}

export function NoConnectionEmpty({ onRetry }) {
  return (
    <EmptyState
      emoji="🌐"
      title="No internet connection"
      description="Please check your connection and try again."
      action={
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Retry Connection
        </button>
      }
    />
  );
}

export function NoPermissionEmpty() {
  return (
    <EmptyState
      emoji="🔒"
      title="Access restricted"
      description="You don't have permission to view this content."
      action={
        <button
          onClick={() => window.location.href = '/settings'}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
        >
          Go to Settings
        </button>
      }
    />
  );
}

export function ComingSoonEmpty({ feature = 'This feature' }) {
  return (
    <EmptyState
      emoji="🚀"
      title="Coming Soon"
      description={`${feature} is currently under development. Stay tuned for updates!`}
      action={
        <button
          onClick={() => window.open('https://agentmax.dev/updates', '_blank')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Get Updates
        </button>
      }
    />
  );
}

export function MaintenanceEmpty() {
  return (
    <EmptyState
      emoji="🔧"
      title="Under Maintenance"
      description="We're currently performing maintenance. Please check back in a few minutes."
      size="large"
    />
  );
}
