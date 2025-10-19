/**
 * Real-Time Cost Feedback Components
 * 
 * Provides immediate cost feedback for billable actions
 */
import { useState, useEffect } from 'react';
import { DollarSign, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Action Confirmation Dialog with Cost Display
 */
export function ActionConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  action = 'Start New Conversation',
  cost = 3.00,
  description = 'This will start a billable conversation.'
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in">
        <div className="text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          
          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {action}?
          </h3>
          
          {/* Description */}
          <p className="text-gray-600 dark:text-gray-400 mb-1">
            {description}
          </p>
          
          {/* Cost Display */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mt-3 mb-6">
            <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Cost: ${cost.toFixed(2)} when marked successful
            </span>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              Start (${cost.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Success Toast with Cost Information
 */
export function showSuccessWithCost(message, cost) {
  toast.custom((t) => (
    <div className={`${t.visible ? 'animate-slide-in' : 'animate-slide-out'} bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 flex items-start gap-3 max-w-sm`}>
      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-medium text-gray-900 dark:text-gray-100">{message}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
          <DollarSign className="w-3 h-3" />
          Billed: ${cost.toFixed(2)}
        </p>
      </div>
      <button
        onClick={() => toast.dismiss(t.id)}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  ), { duration: 5000 });
}

/**
 * Continuous Cost Display Indicator
 */
export function CostIndicator({ currentCost = 0, isActive = false }) {
  const [animatedCost, setAnimatedCost] = useState(currentCost);
  
  useEffect(() => {
    // Animate cost changes
    if (animatedCost !== currentCost) {
      const diff = currentCost - animatedCost;
      const steps = 20;
      const increment = diff / steps;
      let step = 0;
      
      const timer = setInterval(() => {
        step++;
        if (step <= steps) {
          setAnimatedCost(prev => prev + increment);
        } else {
          setAnimatedCost(currentCost);
          clearInterval(timer);
        }
      }, 30);
      
      return () => clearInterval(timer);
    }
  }, [currentCost]);

  return (
    <div className={`fixed bottom-4 right-4 z-40 transition-all duration-300 ${
      isActive ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
    }`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Animated Dollar Icon */}
          <div className={`${isActive ? 'animate-pulse' : ''}`}>
            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          
          {/* Cost Display */}
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${animatedCost.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              This session
            </div>
          </div>
          
          {/* Status Indicator */}
          {isActive && (
            <div className="ml-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Quota Warning Banner
 */
export function QuotaWarning({ remaining, total, onUpgrade }) {
  const percentage = ((total - remaining) / total) * 100;
  
  if (percentage < 75) return null;
  
  const isExceeded = remaining <= 0;
  const isCritical = remaining <= 2 && remaining > 0;
  
  return (
    <div className={`quota-warning p-4 rounded-lg flex items-start gap-3 ${
      isExceeded 
        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        : isCritical
        ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
    }`}>
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
        isExceeded ? 'text-red-600' : isCritical ? 'text-orange-600' : 'text-yellow-600'
      }`} />
      
      <div className="flex-1">
        <p className={`font-semibold ${
          isExceeded 
            ? 'text-red-900 dark:text-red-100' 
            : isCritical 
            ? 'text-orange-900 dark:text-orange-100'
            : 'text-yellow-900 dark:text-yellow-100'
        }`}>
          {isExceeded 
            ? 'Monthly limit reached!'
            : isCritical
            ? `Only ${remaining} conversation${remaining === 1 ? '' : 's'} remaining!`
            : 'Running low on conversations'
          }
        </p>
        <p className={`text-sm mt-1 ${
          isExceeded 
            ? 'text-red-700 dark:text-red-300'
            : isCritical
            ? 'text-orange-700 dark:text-orange-300' 
            : 'text-yellow-700 dark:text-yellow-300'
        }`}>
          {isExceeded
            ? 'Upgrade your plan to continue using Agent Max.'
            : `You've used ${total - remaining} of ${total} conversations this month.`
          }
        </p>
      </div>
      
      <button
        onClick={onUpgrade}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isExceeded
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : isCritical
            ? 'bg-orange-600 hover:bg-orange-700 text-white'
            : 'bg-yellow-600 hover:bg-yellow-700 text-white'
        }`}
      >
        Upgrade Now
      </button>
    </div>
  );
}

/**
 * Cost Estimation Preview
 */
export function CostEstimator({ actions = [] }) {
  const calculateCost = () => {
    return actions.reduce((total, action) => {
      return total + (action.cost || 0);
    }, 0);
  };
  
  const totalCost = calculateCost();
  
  return (
    <div className="cost-estimator p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Estimated Cost Breakdown
      </h4>
      
      {/* Action List */}
      <div className="space-y-2 mb-3">
        {actions.map((action, idx) => (
          <div key={idx} className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {action.name}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              ${action.cost?.toFixed(2) || '0.00'}
            </span>
          </div>
        ))}
      </div>
      
      {/* Total */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          Total Estimate
        </span>
        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
          ${totalCost.toFixed(2)}
        </span>
      </div>
      
      {/* Disclaimer */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        * Actual costs may vary based on success/failure
      </p>
    </div>
  );
}
