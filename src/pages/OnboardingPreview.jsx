/**
 * Onboarding Preview Page
 * Standalone page to preview the premium onboarding experience
 * Use ?step=5 to jump to subscription step (0=welcome, 1=name, 2=usecase, 3=account, 4=google, 5=subscription, 6=complete)
 */
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';

export default function OnboardingPreview() {
  // Get step from URL query param
  const urlParams = new URLSearchParams(window.location.search);
  const startStep = parseInt(urlParams.get('step') || '0', 10);

  const handleComplete = (userData) => {
    console.log('[OnboardingPreview] Completed with data:', userData);
    alert('Onboarding completed! Check console for user data.');
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 360,
        height: 520,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
      }}>
        <OnboardingFlow onComplete={handleComplete} startStep={startStep} />
      </div>
    </div>
  );
}
