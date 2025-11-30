/**
 * Usage Dashboard Component
 * 
 * Displays comprehensive billing and usage information with visual feedback
 */
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Calendar, AlertCircle, Coins } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import apiConfigManager from '../../config/apiConfig';
import { creditsAPI, telemetryAPI } from '../../services/api';

export function UsageDashboard({ tenantId = 'test-tenant-001' }) {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dailyUsage, setDailyUsage] = useState([]);
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    fetchUsageData();
    fetchDailyUsage();
  }, [tenantId]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const apiUrl = apiConfigManager.getConfig().baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/api/v2/billing/usage/${encodeURIComponent(tenantId)}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try { detail = await response.text(); } catch {}
        }
        // Fallback if endpoint not found
        if (response.status === 404) {
          // Try telemetry fallback first
          try {
            const statsRes = await telemetryAPI.getStats();
            const stats = statsRes?.data || {};
            // Best-effort mapping from common shapes
            const current = stats.conversations_this_month ?? stats?.conversations?.month ?? stats?.conversations ?? 0;
            const limit = stats.monthly_limit ?? null;
            const estimatedCost = stats.estimated_cost_month ?? stats?.cost?.month ?? stats?.estimated_cost ?? 0;
            const successfulCount = stats.successful_count ?? stats?.success?.count ?? null;
            const totalCount = stats.total_count ?? stats?.conversations_total ?? null;
            const successRate = stats.success_rate ?? (
              totalCount && totalCount > 0 && successfulCount != null
                ? Math.round((successfulCount / totalCount) * 100)
                : null
            );

            setUsage({ current, limit, estimatedCost, successRate: successRate ?? 0, successfulCount: successfulCount ?? 0 });
            setCredits(null);
            setError(null);
            return;
          } catch (teleErr) {
            console.warn('[UsageDashboard] Telemetry fallback failed, trying credits', {
              tenantId,
              message: teleErr?.message,
            });
            try {
              const balRes = await creditsAPI.getBalance(tenantId);
              const bal = balRes?.data?.balance ?? balRes?.data?.credits ?? null;
              setCredits(typeof bal === 'number' ? bal : null);
              setUsage(null);
              setError(null);
              return;
            } catch (fbErr) {
              console.error('[UsageDashboard] Fallback credits error', {
                tenantId,
                baseURL: apiConfigManager.getConfig().baseURL,
                message: fbErr?.message,
              });
              throw new Error(`Usage 404 — telemetry and credits fallbacks failed: ${fbErr?.message || teleErr?.message || 'unknown error'}`);
            }
          }
        }
        throw new Error(`Usage ${response.status} ${response.statusText} — ${detail || 'no details'}`);
      }
      
      const data = await response.json();
      setUsage(data);
      setError(null);
    } catch (err) {
      console.error('[UsageDashboard] Error fetching usage', {
        tenantId,
        baseURL: apiConfigManager.getConfig().baseURL,
        message: err?.message,
      });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyUsage = async () => {
    try {
      const apiUrl = apiConfigManager.getConfig().baseURL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const endpoint = `${apiUrl}/api/v2/billing/daily-usage/${encodeURIComponent(tenantId)}`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        let detail = '';
        try {
          const data = await response.json();
          detail = data?.detail || data?.error || JSON.stringify(data);
        } catch {
          try { detail = await response.text(); } catch {}
        }
        if (response.status === 404) {
          setDailyUsage([]);
          return;
        }
        throw new Error(`Daily usage ${response.status} ${response.statusText} — ${detail || 'no details'}`);
      }

      const data = await response.json();
      setDailyUsage(data.usage || []);
    } catch (err) {
      console.error('[UsageDashboard] Error fetching daily usage', {
        tenantId,
        baseURL: apiConfigManager.getConfig().baseURL,
        message: err?.message,
      });
    }
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 100) return 'text-red-600 bg-red-50 border-red-200';
    if (percentage >= 90) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 90) return 'bg-orange-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="usage-dashboard p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="usage-dashboard p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border-2 border-red-200 dark:border-red-800">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-800 dark:text-red-300">Failed to Load Usage Data</h3>
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        </div>
        <button 
          onClick={fetchUsageData}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentPeriod = {
    start: format(startOfMonth(new Date()), 'MMM d'),
    end: format(endOfMonth(new Date()), 'MMM d')
  };

  const usagePercentage = usage?.limit ? (usage.current / usage.limit) * 100 : 0;
  const costChange = usage?.costChange || 0;
  const remainingConversations = usage?.limit ? Math.max(0, usage.limit - usage.current) : null;

  return (
    <div className="usage-dashboard">
      {/* Header */}
      {!usage && credits !== null ? (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Coins className="w-7 h-7 text-yellow-600" />
            Credits Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Usage metrics endpoint not available. Showing credit balance instead.
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Usage Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Billing period: {currentPeriod.start} - {currentPeriod.end}
          </p>
        </div>
      )}

      {/* Metrics Cards */}
      {(!usage && credits !== null) ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Credits Balance */}
          <div className="metric-card p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Credits Available</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{credits}</span>
                </div>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Purchase more credits in the Credits tab.</p>
              </div>
              <Coins className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Conversations Used */}
          <div className={`metric-card p-4 rounded-lg border-2 ${getUsageColor(usagePercentage)}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium opacity-75">Conversations Completed</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold">{usage?.current || 0}</span>
                  {usage?.limit && (
                    <span className="text-sm opacity-75">/ {usage.limit}</span>
                  )}
                </div>
                {remainingConversations !== null && (
                  <p className="text-xs mt-1 opacity-75">
                    {remainingConversations} remaining
                  </p>
                )}
              </div>
              <Activity className="w-5 h-5 opacity-50" />
            </div>
          </div>

          {/* Estimated Cost */}
          <div className="metric-card p-4 rounded-lg border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Estimated Cost</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    ${usage?.estimatedCost || '0.00'}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {costChange > 0 ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">
                        +${Math.abs(costChange).toFixed(2)} this week
                      </span>
                    </>
                  ) : costChange < 0 ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-green-600" />
                      <span className="text-xs text-green-700 dark:text-green-300">
                        -${Math.abs(costChange).toFixed(2)} this week
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      No change this week
                    </span>
                  )}
                </div>
              </div>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          {/* Success Rate */}
          <div className="metric-card p-4 rounded-lg border-2 border-purple-200 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-800">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Success Rate</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    {usage?.successRate || 0}%
                  </span>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  {usage?.successfulCount || 0} successful
                </p>
              </div>
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Usage Progress Bar */}
      {usage?.limit && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Monthly Usage
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {Math.round(usagePercentage)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ease-out ${getProgressColor(usagePercentage)}`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            />
          </div>
          {usagePercentage >= 90 && (
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {usagePercentage >= 100 
                ? 'Usage limit reached! Upgrade to continue.'
                : `Warning: ${100 - Math.round(usagePercentage)}% remaining`}
            </p>
          )}
        </div>
      )}

      {/* Daily Usage Chart (only when usage endpoint works) */}
      {usage && (
        <div className="usage-chart p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Daily Usage (Last 7 Days)
          </h3>
          <div className="chart-container h-32">
            {dailyUsage.length > 0 ? (
              <div className="flex items-end justify-between h-full gap-1">
                {dailyUsage.slice(-7).map((day, idx) => {
                  const height = day.count ? (day.count / Math.max(...dailyUsage.map(d => d.count))) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                      <div className="relative w-full group">
                        <div 
                          className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                          style={{ height: `${height}px`, minHeight: height > 0 ? '4px' : '0' }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                            {day.count} conversations
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {format(new Date(day.date), 'EEE')}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                No usage data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions mt-6 flex flex-wrap gap-3">
        <button 
          onClick={() => window.location.href = '/billing/history'}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          View Invoices
        </button>
        <button 
          onClick={() => window.location.href = '/settings/billing'}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Update Payment
        </button>
        {usagePercentage >= 75 && (
          <button 
            onClick={() => window.location.hash = '#/settings?tab=billing'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Upgrade Plan
          </button>
        )}
      </div>
    </div>
  );
}
