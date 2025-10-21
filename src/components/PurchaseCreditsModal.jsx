/**
 * Purchase Credits Modal
 * Modal for users to purchase credits via Stripe
 */
import { useState, useEffect } from 'react';
import { X, Loader2, CreditCard, CheckCircle, Zap } from 'lucide-react';
import { creditsAPI } from '../services/api';
import toast from 'react-hot-toast';
import './PurchaseCreditsModal.css';

const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 10,
    pricePerCredit: 0.10,
    popular: false,
    description: 'Perfect for trying out Agent Max'
  },
  {
    id: 'pro',
    name: 'Pro Pack',
    credits: 500,
    price: 40,
    pricePerCredit: 0.08,
    popular: true,
    description: 'Best value for regular users',
    savings: '20% off'
  },
  {
    id: 'unlimited',
    name: 'Power Pack',
    credits: 1000,
    price: 70,
    pricePerCredit: 0.07,
    popular: false,
    description: 'For power users and teams',
    savings: '30% off'
  }
];

export function PurchaseCreditsModal({ isOpen, onClose }) {
  const [selectedPackage, setSelectedPackage] = useState('pro');
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Get user ID on mount
    const id = localStorage.getItem('user_id');
    setUserId(id);
    
    if (!id && isOpen) {
      toast.error('Please wait for user initialization');
      onClose();
    }
  }, [isOpen, onClose]);

  const handlePurchase = async () => {
    if (!userId) {
      toast.error('User not initialized');
      return;
    }

    setLoading(true);
    
    try {
      // Create Stripe checkout session
      const response = await creditsAPI.createCheckout(
        selectedPackage,
        userId,
        `${window.location.origin}/#/purchase-success`,
        `${window.location.origin}/#/purchase-cancel`
      );

      if (response.data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      toast.error('Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="purchase-modal-overlay" onClick={onClose}>
      <div className="purchase-modal" onClick={(e) => e.stopPropagation()}>
        <div className="purchase-modal-header">
          <h2>Purchase Credits</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="purchase-modal-content">
          <p className="subtitle">
            Choose a credit package to continue using Agent Max
          </p>

          <div className="packages-grid">
            {CREDIT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`package-card ${selectedPackage === pkg.id ? 'selected' : ''} ${
                  pkg.popular ? 'popular' : ''
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                {pkg.popular && (
                  <div className="popular-badge">
                    <Zap size={12} />
                    Most Popular
                  </div>
                )}
                
                <div className="package-header">
                  <h3>{pkg.name}</h3>
                  {pkg.savings && (
                    <span className="savings-badge">{pkg.savings}</span>
                  )}
                </div>
                
                <div className="package-credits">
                  <span className="credits-amount">{pkg.credits}</span>
                  <span className="credits-label">credits</span>
                </div>
                
                <div className="package-price">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{pkg.price}</span>
                </div>
                
                <div className="package-unit-price">
                  ${pkg.pricePerCredit.toFixed(3)}/credit
                </div>
                
                <p className="package-description">
                  {pkg.description}
                </p>
                
                {selectedPackage === pkg.id && (
                  <div className="package-selected-indicator">
                    <CheckCircle size={20} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="purchase-info">
            <div className="info-item">
              <CreditCard size={16} />
              <span>Secure payment via Stripe</span>
            </div>
            <div className="info-item">
              <CheckCircle size={16} />
              <span>Credits never expire</span>
            </div>
            <div className="info-item">
              <Zap size={16} />
              <span>Instant credit delivery</span>
            </div>
          </div>

          <div className="purchase-actions">
            <button 
              className="btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handlePurchase}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  Continue to Checkout
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
