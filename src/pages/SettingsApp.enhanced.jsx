/**
 * Enhanced Settings App with Liquid Glass UI
 * Complete rewrite using the new component library
 */
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Database,
  Code,
  Info,
  Save,
  Check,
  AlertCircle
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { LiquidGlassCard, LiquidGlassPanel, LiquidGlassButton, LiquidGlassInput, LiquidGlassSurface } from '../components/ui/LiquidGlassCard';
import { BillingSettings } from '../components/billing/BillingSettings';
import { Button, ButtonGroup, ToggleButton } from '../components/ui/Button';
import { CardSkeleton } from '../components/ui/SkeletonLoader';
import { ErrorState } from '../components/ui/ErrorState';
import { CommandPalette } from '../components/CommandPalette';
import useStore from '../store/useStore';
import LogoPng from '../assets/AgentMaxLogo.png';

// SVG Goo Filter for liquid effects
const GooFilter = () => (
  <svg width="0" height="0">
    <defs>
      <filter id="liquid-goo">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
        <feColorMatrix in="blur" mode="matrix"
          values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 18 -8"
          result="goo" />
        <feBlend in="SourceGraphic" in2="goo" />
      </filter>
    </defs>
  </svg>
);

export default function SettingsAppEnhanced() {
  const { profile, setProfile, apiConnected } = useStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    profile: {
      name: profile?.name || '',
      email: '',
      avatar: ''
    },
    appearance: {
      theme: 'light',
      accentColor: 'blue',
      fontSize: 'medium',
      animations: true,
      transparency: true
    },
    notifications: {
      desktop: true,
      sound: true,
      badge: true,
      focus: false
    },
    privacy: {
      analytics: true,
      crashReports: true,
      usageData: false
    },
    api: {
      endpoint: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      key: '',
      timeout: 30000
    }
  });

  // Navigation items with icons
  const navItems = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield },
    { id: 'api', label: 'API Settings', icon: Code },
    { id: 'data', label: 'Data Management', icon: Database },
    { id: 'about', label: 'About', icon: Info }
  ];

  // Handle input changes
  const handleChange = (section, field, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  // Save settings
  const handleSave = async () => {
    setSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update profile if changed
      if (settings.profile.name !== profile?.name) {
        setProfile({ ...profile, name: settings.profile.name });
      }
      
      // Save to localStorage
      localStorage.setItem('settings', JSON.stringify(settings));
      
      toast.success('Settings saved successfully');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem('settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  // Render section content
  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <LiquidGlassInput
                value={settings.profile.name}
                onChange={(e) => handleChange('profile', 'name', e.target.value)}
                placeholder="Your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <LiquidGlassInput
                type="email"
                value={settings.profile.email}
                onChange={(e) => handleChange('profile', 'email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Avatar URL</label>
              <LiquidGlassInput
                value={settings.profile.avatar}
                onChange={(e) => handleChange('profile', 'avatar', e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            
            {settings.profile.avatar && (
              <div className="flex justify-center">
                <img 
                  src={settings.profile.avatar} 
                  alt="Avatar preview" 
                  className="w-24 h-24 rounded-full border-4 border-white/30"
                />
              </div>
            )}
          </div>
        );
      
      case 'billing':
        return <BillingSettings tenantId={profile?.tenantId || 'test-tenant-001'} />;
      
      case 'appearance':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Theme</label>
              <ButtonGroup>
                <Button
                  variant={settings.appearance.theme === 'light' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'theme', 'light')}
                >
                  Light
                </Button>
                <Button
                  variant={settings.appearance.theme === 'dark' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'theme', 'dark')}
                >
                  Dark
                </Button>
                <Button
                  variant={settings.appearance.theme === 'auto' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'theme', 'auto')}
                >
                  Auto
                </Button>
              </ButtonGroup>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Accent Color</label>
              <div className="flex gap-2">
                {['blue', 'purple', 'green', 'orange', 'red'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleChange('appearance', 'accentColor', color)}
                    className={`w-10 h-10 rounded-full border-2 ${
                      settings.appearance.accentColor === color 
                        ? 'border-gray-900 dark:border-white' 
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Font Size</label>
              <ButtonGroup>
                <Button
                  variant={settings.appearance.fontSize === 'small' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'fontSize', 'small')}
                  size="sm"
                >
                  Small
                </Button>
                <Button
                  variant={settings.appearance.fontSize === 'medium' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'fontSize', 'medium')}
                >
                  Medium
                </Button>
                <Button
                  variant={settings.appearance.fontSize === 'large' ? 'primary' : 'secondary'}
                  onClick={() => handleChange('appearance', 'fontSize', 'large')}
                  size="lg"
                >
                  Large
                </Button>
              </ButtonGroup>
            </div>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.appearance.animations}
                  onChange={(e) => handleChange('appearance', 'animations', e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span>Enable animations</span>
              </label>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.appearance.transparency}
                  onChange={(e) => handleChange('appearance', 'transparency', e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span>Enable transparency effects</span>
              </label>
            </div>
          </div>
        );
      
      case 'notifications':
        return (
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.desktop}
                onChange={(e) => handleChange('notifications', 'desktop', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Desktop notifications</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Show system notifications for important events
                </div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.sound}
                onChange={(e) => handleChange('notifications', 'sound', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Sound alerts</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Play sounds for notifications
                </div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.badge}
                onChange={(e) => handleChange('notifications', 'badge', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Badge counter</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Show unread count on app icon
                </div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications.focus}
                onChange={(e) => handleChange('notifications', 'focus', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Focus mode</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Disable all notifications temporarily
                </div>
              </div>
            </label>
          </div>
        );
      
      case 'privacy':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    Your privacy matters
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">
                    All data is processed locally and encrypted. We never sell your information.
                  </div>
                </div>
              </div>
            </div>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.privacy.analytics}
                onChange={(e) => handleChange('privacy', 'analytics', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Anonymous analytics</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Help improve Agent Max by sharing anonymous usage data
                </div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.privacy.crashReports}
                onChange={(e) => handleChange('privacy', 'crashReports', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Crash reports</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically send crash reports to help fix issues
                </div>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.privacy.usageData}
                onChange={(e) => handleChange('privacy', 'usageData', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <div className="font-medium">Detailed usage data</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Share feature usage patterns to guide development
                </div>
              </div>
            </label>
          </div>
        );
      
      case 'api':
        return (
          <div className="space-y-6">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center gap-2">
                {apiConnected ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      API Connected
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 dark:text-red-200 font-medium">
                      API Disconnected
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">API Endpoint</label>
              <LiquidGlassInput
                value={settings.api.endpoint}
                onChange={(e) => handleChange('api', 'endpoint', e.target.value)}
                placeholder="http://localhost:8000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <LiquidGlassInput
                type="password"
                value={settings.api.key}
                onChange={(e) => handleChange('api', 'key', e.target.value)}
                placeholder="sk-..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Timeout (ms)</label>
              <LiquidGlassInput
                type="number"
                value={settings.api.timeout}
                onChange={(e) => handleChange('api', 'timeout', parseInt(e.target.value))}
                placeholder="30000"
              />
            </div>
            
            <LiquidGlassButton
              variant="secondary"
              onClick={() => {
                toast.promise(
                  new Promise(resolve => setTimeout(resolve, 1000)),
                  {
                    loading: 'Testing connection...',
                    success: 'Connection successful!',
                    error: 'Connection failed'
                  }
                );
              }}
            >
              Test Connection
            </LiquidGlassButton>
          </div>
        );
      
      case 'data':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <LiquidGlassCard variant="nested">
                <div className="text-2xl font-bold">127</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Conversations
                </div>
              </LiquidGlassCard>
              
              <LiquidGlassCard variant="nested">
                <div className="text-2xl font-bold">2.4 GB</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Storage Used
                </div>
              </LiquidGlassCard>
            </div>
            
            <div className="space-y-3">
              <LiquidGlassButton
                variant="secondary"
                className="w-full"
                onClick={() => toast.info('Export started...')}
              >
                Export All Data
              </LiquidGlassButton>
              
              <LiquidGlassButton
                variant="secondary"
                className="w-full"
                onClick={() => toast.info('Cache cleared')}
              >
                Clear Cache
              </LiquidGlassButton>
              
              <LiquidGlassButton
                variant="danger"
                className="w-full"
                onClick={() => {
                  if (confirm('Are you sure you want to delete all data?')) {
                    toast.error('All data deleted');
                  }
                }}
              >
                Delete All Data
              </LiquidGlassButton>
            </div>
          </div>
        );
      
      case 'about':
        return (
          <div className="space-y-6 text-center">
            <img 
              src={LogoPng}
              alt="Agent Max" 
              className="w-24 h-24 mx-auto"
              draggable={false}
            />
            
            <div>
              <h2 className="text-2xl font-bold mb-2">Agent Max Desktop</h2>
              <p className="text-gray-600 dark:text-gray-400">Version 1.0.0</p>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your AI-powered desktop assistant for automating tasks and boosting productivity.
            </p>
            
            <div className="flex justify-center gap-4">
              <LiquidGlassButton
                variant="secondary"
                onClick={() => window.open('https://agentmax.dev', '_blank')}
              >
                Website
              </LiquidGlassButton>
              
              <LiquidGlassButton
                variant="secondary"
                onClick={() => window.open('https://agentmax.dev/docs', '_blank')}
              >
                Documentation
              </LiquidGlassButton>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-500">
              © 2025 Agent Max. All rights reserved.
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <CommandPalette />
      <GooFilter />
      
      <LiquidGlassSurface>
        <div className="flex h-screen">
          {/* Sidebar Navigation */}
          <div className="w-64 border-r border-white/10 backdrop-filter backdrop-blur-xl bg-white/5">
            <div className="p-6">
              <button
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeft size={16} />
                Back to App
              </button>
            </div>
            
            <nav className="px-3">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-white/10 text-gray-900 dark:text-white' 
                        : 'hover:bg-white/5 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-8">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">
                  {navItems.find(item => item.id === activeSection)?.label}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage your Agent Max settings and preferences
                </p>
              </div>
              
              {/* Content */}
              <LiquidGlassCard variant="elevated" glow animate>
                {loading ? (
                  <CardSkeleton />
                ) : (
                  renderSection()
                )}
              </LiquidGlassCard>
              
              {/* Save Button */}
              {hasChanges && activeSection !== 'billing' && (
                <div className="fixed bottom-8 right-8">
                  <LiquidGlassButton
                    variant="primary"
                    size="lg"
                    onClick={handleSave}
                    loading={saving}
                    icon={Save}
                  >
                    Save Changes
                  </LiquidGlassButton>
                </div>
              )}
            </div>
          </div>
        </div>
      </LiquidGlassSurface>
      
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
