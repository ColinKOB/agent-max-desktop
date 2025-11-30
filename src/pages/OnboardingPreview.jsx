/**
 * Onboarding Preview Page
 * Standalone page to preview the premium onboarding experience
 */
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';

export default function OnboardingPreview() {
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
        width: 420,
        height: 700,
        position: 'relative',
      }}>
        <OnboardingFlow onComplete={handleComplete} />
      </div>
    </div>
  );
}
