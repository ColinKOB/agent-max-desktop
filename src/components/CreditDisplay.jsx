/**
 * Credit Display Widget
 * Shows real-time credit balance with live updates
 */
import { useState, useEffect } from 'react';
import { Coins, AlertCircle, Plus, TrendingDown } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

export function CreditDisplay({ userId, onPurchaseClick }) {
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Fetch initial credits
  useEffect(() => {
    if (!userId) return;
    fetchCredits();
  }, [userId]);

  // Poll for updates every 3 seconds (live updates)
  useEffect(() => {
    if (!userId) return;
    
    const interval = setInterval(() => {
      fetchCredits();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [userId]);

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const newCredits = data?.metadata?.credits || 0;
      const prevCredits = credits;
      
      setCredits(newCredits);
      setLoading(false);
      setLastUpdate(Date.now());

      // Show toast when credits change (decrease)
      if (prevCredits !== null && newCredits < prevCredits) {
        const diff = prevCredits - newCredits;
        toast.success(`Used ${diff} credit${diff > 1 ? 's' : ''}. ${newCredits} remaining.`, {
          icon: '💳',
          duration: 2000
        });
      }

      // Show warning if low
      if (newCredits < 10 && newCredits > 0 && prevCredits !== newCredits) {
        toast('⚠️ Low credits! Consider purchasing more.', {
          duration: 4000,
          style: {
            background: '#FEF3C7',
            color: '#92400E'
          }
        });
      }

      // Show error if empty
      if (newCredits === 0 && prevCredits > 0) {
        toast.error('No credits remaining! Purchase more to continue.', {
          duration: 6000
        });
      }
    } catch (error) {
      console.error('[CreditDisplay] Failed to fetch credits:', error);
      setLoading(false);
    }
  };

  const handlePurchase = () => {
    if (onPurchaseClick) {
      onPurchaseClick();
    } else {
      // Default: open settings
      window.location.hash = '#/settings';
      toast('Navigate to Settings → Billing to purchase credits', {
        icon: '💳'
      });
    }
  };

  if (loading) {
    return (
      <div className="credit-display animate-pulse">
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  const isLow = credits < 10;
  const isEmpty = credits === 0;

  return (
    <div className={`credit-display flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
      isEmpty ? 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800' :
      isLow ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800' :
      'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-800'
    }`}>
      <Coins className={`w-4 h-4 ${
        isEmpty ? 'text-red-600' :
        isLow ? 'text-yellow-600' :
        'text-blue-600'
      }`} />
      
      <div className="flex flex-col min-w-[60px]">
        <span className={`text-sm font-bold leading-none ${
          isEmpty ? 'text-red-700 dark:text-red-400' :
          isLow ? 'text-yellow-700 dark:text-yellow-400' :
          'text-blue-700 dark:text-blue-400'
        }`}>
          {credits}
        </span>
        <span className="text-[10px] text-gray-600 dark:text-gray-400 leading-none mt-0.5">
          {credits === 1 ? 'credit' : 'credits'}
        </span>
      </div>

      {(isEmpty || isLow) && (
        <button
          onClick={handlePurchase}
          className={`ml-1 p-1 rounded transition-colors ${
            isEmpty 
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          }`}
          title="Purchase credits"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Optimistic credit counter (for immediate UI updates)
export function useOptimisticCredits(userId) {
  const [optimisticCredits, setOptimisticCredits] = useState(null);

  // Fetch initial from Supabase
  useEffect(() => {
    if (!userId) return;
    
    supabase
      .from('users')
      .select('metadata')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setOptimisticCredits(data?.metadata?.credits || 0);
      })
      .catch(console.error);
  }, [userId]);

  const deductCredit = () => {
    setOptimisticCredits(prev => Math.max(0, prev - 1));
  };

  const addCredits = (amount) => {
    setOptimisticCredits(prev => prev + amount);
  };

  return { optimisticCredits, deductCredit, addCredits };
}
