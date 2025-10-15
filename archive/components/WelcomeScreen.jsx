import { useState } from 'react';
import { ArrowRight, Sparkles, Brain, Zap, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WelcomeScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    primaryUse: '',
    workStyle: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const totalSteps = 4;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleComplete = async () => {
    try {
      // Validate and trim name before saving
      const trimmedName = formData.name?.trim();
      if (!trimmedName || trimmedName.length === 0) {
        toast.error('Please enter your name');
        return;
      }
      
      // Save to local memory
      if (window.electron?.memory) {
        // Set name
        await window.electron.memory.setName(trimmedName);
        
        // Set preferences
        await window.electron.memory.setPreference('role', formData.role, 'work');
        await window.electron.memory.setPreference('primary_use', formData.primaryUse, 'work');
        await window.electron.memory.setPreference('work_style', formData.workStyle, 'work');
        await window.electron.memory.setPreference('timezone', formData.timezone, 'system');
        await window.electron.memory.setPreference('onboarding_completed', true, 'system');
        await window.electron.memory.setPreference('onboarding_date', new Date().toISOString(), 'system');
      }

      toast.success('Welcome to Agent Max! 🎉');
      onComplete({ ...formData, name: trimmedName });
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
      toast.error('Failed to save preferences');
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return formData.role.length > 0;
      case 3:
        return formData.primaryUse.length > 0;
      case 4:
        return formData.workStyle.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-icon">
            <Sparkles className="w-12 h-12" />
          </div>
          <h1 className="welcome-title">Welcome to Agent Max</h1>
          <p className="welcome-subtitle">
            Your intelligent AI assistant that learns about you
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="welcome-progress">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`progress-dot ${s <= step ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="welcome-steps">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="step-content">
              <div className="step-icon">
                <Brain className="w-8 h-8" />
              </div>
              <h2 className="step-title">What's your name?</h2>
              <p className="step-description">
                I'll use this to personalize our conversations
              </p>
              <input
                type="text"
                className="welcome-input"
                placeholder="Enter your name..."
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && canProceed() && handleNext()}
                autoFocus
              />
            </div>
          )}

          {/* Step 2: Role */}
          {step === 2 && (
            <div className="step-content">
              <div className="step-icon">
                <Zap className="w-8 h-8" />
              </div>
              <h2 className="step-title">What do you do?</h2>
              <p className="step-description">
                This helps me understand how to assist you better
              </p>
              <div className="option-grid">
                {[
                  { value: 'developer', label: '👨‍💻 Developer' },
                  { value: 'designer', label: '🎨 Designer' },
                  { value: 'manager', label: '📊 Manager' },
                  { value: 'student', label: '📚 Student' },
                  { value: 'researcher', label: '🔬 Researcher' },
                  { value: 'writer', label: '✍️ Writer' },
                  { value: 'entrepreneur', label: '🚀 Entrepreneur' },
                  { value: 'other', label: '🌟 Other' },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`option-button ${
                      formData.role === option.value ? 'selected' : ''
                    }`}
                    onClick={() => handleInputChange('role', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Primary Use */}
          {step === 3 && (
            <div className="step-content">
              <div className="step-icon">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="step-title">What will you use me for?</h2>
              <p className="step-description">
                Select your primary use case
              </p>
              <div className="option-grid">
                {[
                  { value: 'coding', label: '💻 Coding & Development' },
                  { value: 'automation', label: '⚡ Task Automation' },
                  { value: 'research', label: '🔍 Research & Learning' },
                  { value: 'productivity', label: '📈 Productivity' },
                  { value: 'creative', label: '🎨 Creative Work' },
                  { value: 'general', label: '🌐 General Assistant' },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`option-button ${
                      formData.primaryUse === option.value ? 'selected' : ''
                    }`}
                    onClick={() => handleInputChange('primaryUse', option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Work Style */}
          {step === 4 && (
            <div className="step-content">
              <div className="step-icon">
                <Check className="w-8 h-8" />
              </div>
              <h2 className="step-title">How do you work?</h2>
              <p className="step-description">
                This helps me match your communication style
              </p>
              <div className="option-list">
                {[
                  {
                    value: 'detailed',
                    label: 'Detailed & Thorough',
                    desc: 'I want comprehensive explanations',
                  },
                  {
                    value: 'concise',
                    label: 'Quick & Concise',
                    desc: 'Just give me the key points',
                  },
                  {
                    value: 'interactive',
                    label: 'Interactive & Guided',
                    desc: 'Walk me through step-by-step',
                  },
                  {
                    value: 'autonomous',
                    label: 'Autonomous',
                    desc: 'Handle it automatically when possible',
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`option-card ${
                      formData.workStyle === option.value ? 'selected' : ''
                    }`}
                    onClick={() => handleInputChange('workStyle', option.value)}
                  >
                    <div className="option-card-title">{option.label}</div>
                    <div className="option-card-desc">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="welcome-nav">
          {step > 1 && (
            <button
              className="nav-button secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step < totalSteps ? (
            <button
              className={`nav-button primary ${!canProceed() ? 'disabled' : ''}`}
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Next <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          ) : (
            <button
              className={`nav-button primary ${!canProceed() ? 'disabled' : ''}`}
              onClick={handleComplete}
              disabled={!canProceed()}
            >
              Get Started <Sparkles className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
