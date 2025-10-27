import { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  Palette,
  Shield,
  Bell,
  User,
  Database,
  Sparkles,
  ChevronRight,
  Check,
  X,
  Laptop,
  Smartphone,
  Globe,
  Lock,
  CreditCard,
  HelpCircle,
  LogOut,
  Settings as SettingsIcon,
  Zap,
  Eye,
  EyeOff,
  Monitor,
} from 'lucide-react';
import useStore from '../store/useStore';
import { reconfigureAPI, permissionAPI } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/premium-glass.css';
import PermissionLevelSelector from '../components/settings/PermissionLevelSelector';
import { GoogleConnect } from '../components/GoogleConnect';
import { usePermission } from '../contexts/PermissionContext';

// Helper: Recent activity list (mini)
function RecentActivityList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await permissionAPI.getActivityLog('all', 5);
        const data = res.data || res;
        if (mounted) setItems(data.activities || []);
      } catch (e) {
        if (mounted) setError('Failed to load activity');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
        Loading recent activity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
        {error}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((a, idx) => (
        <div key={a.id || idx} className="p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-white text-sm font-medium truncate mr-2">
              {a.action}
            </div>
            <div className="text-xs text-white/50">
              {a.permission_level}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/60">
            <span>{new Date(a.timestamp).toLocaleString()}</span>
            {a.required_approval && (
              <span className={a.approved ? 'text-emerald-300' : 'text-red-300'}>
                {a.approved ? 'Approved' : 'Denied'}
              </span>
            )}
            {a.is_high_risk && (
              <span className="text-red-300">High Risk</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const SettingsSection = ({ icon: Icon, title, children, badge }) => (
  <div className="premium-glass-card">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {badge && (
        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/10">
          {badge}
        </span>
      )}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const ToggleSwitch = ({ enabled, onChange, label, description }) => (
  <div className="flex items-start justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all duration-300 group">
    <div className="flex-1">
      <p className="text-white font-medium mb-1">{label}</p>
      {description && (
        <p className="text-white/60 text-sm">{description}</p>
      )}
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
        enabled 
          ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
          : 'bg-white/20'
      }`}
    >
      <div 
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-lg transition-transform duration-300 ${
          enabled ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

const ThemeCard = ({ theme, currentTheme, icon: Icon, label, colors, onClick }) => (
  <button
    onClick={onClick}
    className={`relative p-4 rounded-xl border transition-all duration-300 ${
      currentTheme === theme
        ? 'border-white/40 bg-gradient-to-br from-white/20 to-white/5 scale-[1.02]'
        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
    }`}
  >
    {currentTheme === theme && (
      <div className="absolute top-2 right-2">
        <Check className="w-4 h-4 text-white" />
      </div>
    )}
    <div className="flex flex-col items-center gap-3">
      <div className={`p-3 rounded-lg ${colors}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-sm font-medium text-white">{label}</span>
    </div>
  </button>
);

export default function SettingsPremium() {
  const { theme, setTheme } = useStore();
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  
  // Premium settings state
  const [settings, setSettings] = useState({
    notifications: true,
    sounds: true,
    autoStart: false,
    minimizeToTray: true,
    hardwareAcceleration: true,
    reducedMotion: false,
    highContrast: false,
    analytics: true,
    crashReports: true,
    betaFeatures: false,
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    toast.success(`${key.charAt(0).toUpperCase() + key.slice(1)} ${value ? 'enabled' : 'disabled'}`);
  };

  return (
    <div className="premium-settings-container">
      {/* Header */}
      <div className="premium-settings-header">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
          <p className="text-white/60">Customize your Agent Max experience</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 text-sm font-medium border border-green-500/20">
            Connected
          </span>
        </div>
      </div>

      <div className="premium-settings-grid">
        {/* Appearance */}
        <SettingsSection icon={Palette} title="Appearance">
          <div className="space-y-4">
            <div>
              <p className="text-white/80 text-sm font-medium mb-3">Theme</p>
              <div className="grid grid-cols-3 gap-3">
                <ThemeCard
                  theme="light"
                  currentTheme={theme}
                  icon={Sun}
                  label="Light"
                  colors="bg-gradient-to-br from-yellow-400/30 to-orange-400/30"
                  onClick={() => setTheme('light')}
                />
                <ThemeCard
                  theme="dark"
                  currentTheme={theme}
                  icon={Moon}
                  label="Dark"
                  colors="bg-gradient-to-br from-blue-500/30 to-indigo-500/30"
                  onClick={() => setTheme('dark')}
                />
                <ThemeCard
                  theme="auto"
                  currentTheme={theme}
                  icon={Monitor}
                  label="System"
                  colors="bg-gradient-to-br from-purple-500/30 to-pink-500/30"
                  onClick={() => setTheme('auto')}
                />
              </div>
            </div>
            
            <ToggleSwitch
              enabled={settings.reducedMotion}
              onChange={(v) => updateSetting('reducedMotion', v)}
              label="Reduce Motion"
              description="Minimize animations and transitions"
            />
            
            <ToggleSwitch
              enabled={settings.highContrast}
              onChange={(v) => updateSetting('highContrast', v)}
              label="High Contrast"
              description="Increase visual contrast for better readability"
            />
          </div>
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection icon={Bell} title="Notifications">
          <ToggleSwitch
            enabled={settings.notifications}
            onChange={(v) => updateSetting('notifications', v)}
            label="Desktop Notifications"
            description="Get notified about important events"
          />
          <ToggleSwitch
            enabled={settings.sounds}
            onChange={(v) => updateSetting('sounds', v)}
            label="Sound Effects"
            description="Play sounds for actions and alerts"
          />
        </SettingsSection>

        {/* System */}
        <SettingsSection icon={Zap} title="System" badge="Performance">
          <ToggleSwitch
            enabled={settings.autoStart}
            onChange={(v) => updateSetting('autoStart', v)}
            label="Launch at Startup"
            description="Start Agent Max when you log in"
          />
          <ToggleSwitch
            enabled={settings.minimizeToTray}
            onChange={(v) => updateSetting('minimizeToTray', v)}
            label="Minimize to System Tray"
            description="Keep running in background when closed"
          />
          <ToggleSwitch
            enabled={settings.hardwareAcceleration}
            onChange={(v) => updateSetting('hardwareAcceleration', v)}
            label="Hardware Acceleration"
            description="Use GPU for better performance"
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection icon={Shield} title="Privacy & Security">
          <ToggleSwitch
            enabled={settings.analytics}
            onChange={(v) => updateSetting('analytics', v)}
            label="Usage Analytics"
            description="Help improve Agent Max by sharing anonymous usage data"
          />
          <ToggleSwitch
            enabled={settings.crashReports}
            onChange={(v) => updateSetting('crashReports', v)}
            label="Crash Reports"
            description="Automatically send crash reports to help fix issues"
          />
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-white font-medium mb-1">End-to-End Encryption</p>
                <p className="text-white/60 text-sm">All your data is encrypted and secure</p>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Permission Levels */}
        <SettingsSection icon={Shield} title="Permissions & Safety" badge="New">
          <PermissionLevelSelector
            currentLevel={usePermission().level}
            onChange={usePermission().updateLevel}
            loading={usePermission().loading}
          />
        </SettingsSection>

        {/* Activity Log (recent) */}
        <SettingsSection icon={Monitor} title="Recent Activity">
          <RecentActivityList />
        </SettingsSection>

        {/* Google Services */}
        <SettingsSection icon={Globe} title="Google Services" badge="Connect">
          <GoogleConnect />
        </SettingsSection>

        {/* API Configuration */}
        <SettingsSection icon={Globe} title="API Configuration">
          <div className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                API Endpoint
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all duration-300"
                placeholder="http://localhost:8000"
              />
            </div>
            
            <button
              onClick={() => {
                reconfigureAPI(apiUrl);
                toast.success('API settings updated');
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-300 transform hover:scale-[1.02]"
            >
              Save Configuration
            </button>
          </div>
        </SettingsSection>

        {/* Beta Features */}
        <SettingsSection icon={Sparkles} title="Beta Features" badge="New">
          <ToggleSwitch
            enabled={settings.betaFeatures}
            onChange={(v) => updateSetting('betaFeatures', v)}
            label="Enable Beta Features"
            description="Try new features before they're officially released"
          />
          {settings.betaFeatures && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <p className="text-white/80 text-sm">
                🚀 You're using beta features! Some things might be unstable.
              </p>
            </div>
          )}
        </SettingsSection>
      </div>

      {/* Quick Actions */}
      <div className="premium-settings-actions">
        <button className="premium-action-button">
          <Database className="w-4 h-4" />
          <span>Clear Cache</span>
        </button>
        <button className="premium-action-button">
          <HelpCircle className="w-4 h-4" />
          <span>Help Center</span>
        </button>
        <button className="premium-action-button text-red-400">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
