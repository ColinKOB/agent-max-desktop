import { User, Calendar, Activity, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useStore from '../store/useStore';

export default function ProfileCard() {
  const { profile, greeting } = useStore();

  if (!profile) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      </div>
    );
  }

  const { name, temporal_info, interaction_count, top_preferences } = profile;

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {name ? name[0].toUpperCase() : <User className="w-8 h-8" />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {name || 'Guest User'}
            </h2>
            {greeting && <p className="text-gray-600 dark:text-gray-400 mt-1">{greeting}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Activity className="w-6 h-6 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {interaction_count || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Interactions</p>
        </div>

        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Calendar className="w-6 h-6 mx-auto text-green-500 mb-2" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {temporal_info?.last_seen
              ? (() => {
                  try {
                    const date = new Date(temporal_info.last_seen);
                    if (isNaN(date.getTime())) return 'Never';
                    return formatDistanceToNow(date, { addSuffix: true });
                  } catch {
                    return 'Never';
                  }
                })()
              : 'Never'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last Seen</p>
        </div>

        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Heart className="w-6 h-6 mx-auto text-pink-500 mb-2" />
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {temporal_info?.frequency || 'New User'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Frequency</p>
        </div>
      </div>

      {top_preferences && top_preferences.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Top Preferences
          </h3>
          <div className="flex flex-wrap gap-2">
            {top_preferences.slice(0, 5).map((pref, idx) => (
              <span
                key={idx}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
              >
                {pref}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
