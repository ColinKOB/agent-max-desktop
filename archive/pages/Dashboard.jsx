import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import useStore from '../store/useStore';
import { profileAPI, conversationAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { profile, setProfile, greeting, setGreeting, pendingTasks, setPendingTasks, setLoading } =
    useStore();
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load profile
      const profileRes = await profileAPI.getProfile();
      setProfile(profileRes.data);

      // Load greeting
      const greetingRes = await profileAPI.getGreeting();
      setGreeting(greetingRes.data.greeting);

      // Load pending tasks
      const tasksRes = await conversationAPI.getTasks();
      setPendingTasks(tasksRes.data.tasks || []);

      // Load insights
      const insightsRes = await profileAPI.getInsights();
      setInsights(insightsRes.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      await conversationAPI.completeTask(task);
      setPendingTasks(pendingTasks.filter((t) => t !== task));
      toast.success('Task completed!');
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Dashboard</h1>

      {/* Profile Card */}
      <div className="mb-8">
        <ProfileCard />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Activity}
          label="Interactions"
          value={profile?.interaction_count || 0}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Tasks Completed"
          value={insights?.tasks_completed || 0}
          color="green"
        />
        <StatCard icon={Clock} label="Pending Tasks" value={pendingTasks.length} color="yellow" />
        <StatCard
          icon={TrendingUp}
          label="Facts Stored"
          value={insights?.total_facts || 0}
          color="purple"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Tasks */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Pending Tasks</h2>
          {pendingTasks.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No pending tasks. Great job! 🎉
            </p>
          ) : (
            <div className="space-y-3">
              {pendingTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <p className="text-gray-900 dark:text-gray-100">{task}</p>
                  <button
                    onClick={() => handleCompleteTask(task)}
                    className="btn-primary text-sm px-3 py-1"
                  >
                    Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Insights */}
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Insights</h2>
          {insights ? (
            <div className="space-y-4">
              {insights.top_categories && insights.top_categories.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Top Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {insights.top_categories.map((cat, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {insights.recent_activity && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Recent Activity
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {insights.recent_activity}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No insights available yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
