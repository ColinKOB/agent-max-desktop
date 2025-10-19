/**
 * Test file for the new UI/UX components
 * This will test the Liquid Glass components and billing features
 */
import { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { LiquidGlassCard, LiquidGlassPanel, LiquidGlassButton, LiquidGlassSurface } from './components/ui/LiquidGlassCard';
import { UsageDashboard } from './components/billing/UsageDashboard';
import { ActionConfirmation, CostIndicator, QuotaWarning, showSuccessWithCost } from './components/billing/CostFeedback';
import { BillingHistory } from './components/billing/BillingHistory';
import { BillingSettings } from './components/billing/BillingSettings';
import { CommandPalette } from './components/CommandPalette';
import { SkeletonLoader, CardSkeleton, DashboardSkeleton } from './components/ui/SkeletonLoader';
import { EmptyState, NoConversationsEmpty } from './components/ui/EmptyState';
import { ErrorState, NetworkError, QuotaExceededError } from './components/ui/ErrorState';
import { Button, IconButton, ButtonGroup, FAB } from './components/ui/Button';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';

function TestApp() {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [showActionConfirm, setShowActionConfirm] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setLoading(false);
      // Check if first time user
      const hasOnboarded = localStorage.getItem('onboarding_completed');
      if (!hasOnboarded) {
        setShowOnboarding(true);
      }
    }, 2000);
  }, []);

  const handleOnboardingComplete = (userData) => {
    localStorage.setItem('onboarding_completed', 'true');
    setShowOnboarding(false);
    toast.success(`Welcome, ${userData.name}!`);
  };

  const handleStartConversation = () => {
    setShowActionConfirm(true);
  };

  const handleConfirmAction = () => {
    setSessionCost(prev => prev + 3.00);
    showSuccessWithCost('Conversation started successfully!', 3.00);
    setShowActionConfirm(false);
  };

  const handleNetworkError = () => {
    setError({ type: 'network' });
  };

  const handleQuotaError = () => {
    setError({ type: 'quota' });
  };

  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onSkip={() => setShowOnboarding(false)}
      />
    );
  }

  if (loading) {
    return (
      <LiquidGlassSurface>
        <div className="p-8">
          <DashboardSkeleton />
        </div>
      </LiquidGlassSurface>
    );
  }

  if (error) {
    return (
      <LiquidGlassSurface>
        <div className="flex items-center justify-center min-h-screen">
          {error.type === 'network' ? (
            <NetworkError onRetry={() => setError(null)} />
          ) : error.type === 'quota' ? (
            <QuotaExceededError
              onUpgrade={() => window.open('https://agentmax.dev/upgrade', '_blank')}
              onViewUsage={() => setCurrentView('billing')}
            />
          ) : null}
        </div>
      </LiquidGlassSurface>
    );
  }

  return (
    <>
      {/* Command Palette */}
      <CommandPalette />

      {/* Main Surface */}
      <LiquidGlassSurface>
        <LiquidGlassPanel
          header={
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Agent Max Desktop</h1>
              <div className="flex gap-2">
                <LiquidGlassButton
                  variant={currentView === 'dashboard' ? 'primary' : 'secondary'}
                  onClick={() => setCurrentView('dashboard')}
                >
                  Dashboard
                </LiquidGlassButton>
                <LiquidGlassButton
                  variant={currentView === 'billing' ? 'primary' : 'secondary'}
                  onClick={() => setCurrentView('billing')}
                >
                  Billing
                </LiquidGlassButton>
                <LiquidGlassButton
                  variant={currentView === 'history' ? 'primary' : 'secondary'}
                  onClick={() => setCurrentView('history')}
                >
                  History
                </LiquidGlassButton>
                <LiquidGlassButton
                  variant={currentView === 'settings' ? 'primary' : 'secondary'}
                  onClick={() => setCurrentView('settings')}
                >
                  Settings
                </LiquidGlassButton>
              </div>
            </div>
          }
        >
          <div className="max-w-7xl mx-auto p-6">
            {/* Current View */}
            {currentView === 'dashboard' && (
              <div className="space-y-6">
                {/* Usage Dashboard */}
                <LiquidGlassCard variant="elevated" glow animate>
                  <UsageDashboard tenantId="test-tenant-001" />
                </LiquidGlassCard>

                {/* Quota Warning */}
                <QuotaWarning
                  remaining={5}
                  total={50}
                  onUpgrade={() => window.open('https://agentmax.dev/upgrade', '_blank')}
                />

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <LiquidGlassCard interactive>
                    <h3 className="text-lg font-semibold mb-2">Start Conversation</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Begin a new AI-powered conversation
                    </p>
                    <LiquidGlassButton
                      variant="primary"
                      onClick={handleStartConversation}
                    >
                      Start Now ($3)
                    </LiquidGlassButton>
                  </LiquidGlassCard>

                  <LiquidGlassCard interactive>
                    <h3 className="text-lg font-semibold mb-2">View History</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      See all your past conversations
                    </p>
                    <LiquidGlassButton
                      variant="secondary"
                      onClick={() => setCurrentView('history')}
                    >
                      View History
                    </LiquidGlassButton>
                  </LiquidGlassCard>

                  <LiquidGlassCard interactive>
                    <h3 className="text-lg font-semibold mb-2">Manage Billing</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Update payment and view invoices
                    </p>
                    <LiquidGlassButton
                      variant="secondary"
                      onClick={() => setCurrentView('billing')}
                    >
                      Manage
                    </LiquidGlassButton>
                  </LiquidGlassCard>
                </div>

                {/* Empty State Example */}
                {false && (
                  <LiquidGlassCard>
                    <NoConversationsEmpty onStart={handleStartConversation} />
                  </LiquidGlassCard>
                )}
              </div>
            )}

            {currentView === 'billing' && (
              <LiquidGlassCard variant="elevated" animate>
                <BillingSettings tenantId="test-tenant-001" />
              </LiquidGlassCard>
            )}

            {currentView === 'history' && (
              <LiquidGlassCard variant="elevated" animate>
                <BillingHistory tenantId="test-tenant-001" />
              </LiquidGlassCard>
            )}

            {currentView === 'settings' && (
              <div className="space-y-6">
                <LiquidGlassCard>
                  <h2 className="text-xl font-bold mb-4">Settings</h2>
                  <p className="text-gray-600">Settings panel coming soon...</p>
                </LiquidGlassCard>

                {/* Button Examples */}
                <LiquidGlassCard>
                  <h3 className="text-lg font-semibold mb-4">Button Examples</h3>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary">Primary</Button>
                      <Button variant="secondary">Secondary</Button>
                      <Button variant="success">Success</Button>
                      <Button variant="danger">Danger</Button>
                      <Button variant="warning">Warning</Button>
                      <Button variant="ghost">Ghost</Button>
                      <Button variant="outline">Outline</Button>
                      <Button variant="link">Link</Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="xs">Extra Small</Button>
                      <Button size="sm">Small</Button>
                      <Button size="md">Medium</Button>
                      <Button size="lg">Large</Button>
                      <Button size="xl">Extra Large</Button>
                    </div>

                    <ButtonGroup>
                      <Button>First</Button>
                      <Button>Second</Button>
                      <Button>Third</Button>
                    </ButtonGroup>
                  </div>
                </LiquidGlassCard>

                {/* Test Error States */}
                <LiquidGlassCard>
                  <h3 className="text-lg font-semibold mb-4">Test Error States</h3>
                  <div className="flex gap-2">
                    <Button onClick={handleNetworkError}>
                      Trigger Network Error
                    </Button>
                    <Button onClick={handleQuotaError}>
                      Trigger Quota Error
                    </Button>
                  </div>
                </LiquidGlassCard>
              </div>
            )}
          </div>

          {/* Cost Indicator */}
          <CostIndicator currentCost={sessionCost} isActive={sessionCost > 0} />

          {/* Action Confirmation Modal */}
          <ActionConfirmation
            isOpen={showActionConfirm}
            onClose={() => setShowActionConfirm(false)}
            onConfirm={handleConfirmAction}
            action="Start New Conversation"
            cost={3.00}
            description="This will start a billable AI conversation."
          />
        </LiquidGlassPanel>
      </LiquidGlassSurface>

      {/* FAB for quick actions */}
      <FAB
        icon={() => <span>💬</span>}
        label="New Chat"
        position="bottom-right"
        onClick={handleStartConversation}
      />

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            color: '#1f2937',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
    </>
  );
}

export default TestApp;
