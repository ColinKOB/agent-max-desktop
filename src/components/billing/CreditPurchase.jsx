/**
 * Credit Purchase Component
 * Embedded Stripe Checkout for purchasing credits
 */
import { useState, useEffect } from 'react';
import { Coins, Check, Zap, AlertCircle, Loader2, X } from 'lucide-react';
import { creditsAPI } from '../../services/api';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import './CreditPurchase.css';

export function CreditPurchase({ userId, onClose, onSuccess }) {
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [currentCredits, setCurrentCredits] = useState(0);

  useEffect(() => {
    loadPackages();
    loadCurrentCredits();
  }, [userId]);

  const loadPackages = async () => {
    try {
      const response = await creditsAPI.getPackages();
      const pkgs = response?.data?.packages || response?.data || [];
      setPackages(pkgs);
      // Pre-select the middle package (pro)
      if (pkgs.length > 0) {
        setSelectedPackage(pkgs[1]?.id || pkgs[0]?.id);
      }
    } catch (error) {
      console.error('Failed to load packages:', error);
      toast.error('Failed to load credit packages');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentCredits = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('metadata')
        .eq('id', userId)
        .single();
      
      setCurrentCredits(data?.metadata?.credits || 0);
    } catch (error) {
      console.error('Failed to load credits:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedPackage || !userId) return;

    try {
      setPurchasing(true);
      
      // Create checkout session
      const response = await creditsAPI.createCheckout(
        selectedPackage,
        userId,
        `${window.location.origin}/#/settings?purchase=success`,
        `${window.location.origin}/#/settings?purchase=cancel`
      );

      const checkoutUrl = response?.data?.url;
      
      if (checkoutUrl) {
        // Open Stripe Checkout in the same window
        // The Stripe page will redirect back to settings after completion
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('Failed to start checkout. Please try again.');
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="credit-purchase-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600 dark:text-gray-400 mt-2">Loading packages...</p>
      </div>
    );
  }

  const selectedPkg = packages.find(p => p.id === selectedPackage);

  return (
    <div className="credit-purchase">
      {/* Header */}
      <div className="credit-purchase-header">
        <div className="flex items-center gap-3">
          <div className="icon-wrapper">
            <Coins className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Purchase Credits
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current balance: <span className="font-semibold text-blue-600">{currentCredits} credits</span>
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="close-btn"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Package Selection */}
      <div className="package-grid">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => setSelectedPackage(pkg.id)}
            className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''}`}
            disabled={purchasing}
          >
            {/* Badge for best value */}
            {pkg.id === 'pro' && (
              <div className="best-value-badge">
                <Zap className="w-3 h-3" />
                Best Value
              </div>
            )}

            {/* Check mark for selected */}
            {selectedPackage === pkg.id && (
              <div className="selected-indicator">
                <Check className="w-4 h-4" />
              </div>
            )}

            {/* Package Info */}
            <div className="package-info">
              <h3 className="package-name">{pkg.name}</h3>
              <div className="package-credits">
                <Coins className="w-5 h-5" />
                <span>{pkg.credits.toLocaleString()} credits</span>
              </div>
              <div className="package-price">
                <span className="price-amount">${pkg.price_usd.toFixed(2)}</span>
                <span className="price-per">${pkg.price_per_credit.toFixed(3)}/credit</span>
              </div>
            </div>

            {/* Features */}
            <ul className="package-features">
              <li>
                <Check className="w-4 h-4" />
                <span>{pkg.credits} AI conversations</span>
              </li>
              <li>
                <Check className="w-4 h-4" />
                <span>Never expires</span>
              </li>
              <li>
                <Check className="w-4 h-4" />
                <span>Priority support</span>
              </li>
            </ul>
          </button>
        ))}
      </div>

      {/* Selected Package Summary */}
      {selectedPkg && (
        <div className="purchase-summary">
          <div className="summary-row">
            <span className="summary-label">Package:</span>
            <span className="summary-value">{selectedPkg.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Credits:</span>
            <span className="summary-value">{selectedPkg.credits.toLocaleString()}</span>
          </div>
          <div className="summary-row total">
            <span className="summary-label">Total:</span>
            <span className="summary-value">${selectedPkg.price_usd.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="security-notice">
        <AlertCircle className="w-4 h-4 text-blue-600" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Secure payment powered by Stripe. Your payment information is never stored on our servers.
        </p>
      </div>

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!selectedPackage || purchasing}
        className="purchase-btn"
      >
        {purchasing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Redirecting to Stripe...
          </>
        ) : (
          <>
            <Coins className="w-5 h-5" />
            Continue to Checkout
          </>
        )}
      </button>
    </div>
  );
}
