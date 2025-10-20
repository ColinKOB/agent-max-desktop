import { useEffect, useMemo, useRef, useState } from 'react';
import { CreditCard, Globe, Database, Info, Download, Upload, Trash2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { SubscriptionManager } from '../components/SubscriptionManager';
import { GoogleConnect } from '../components/GoogleConnect';
import useStore from '../store/useStore';

const navItems = [
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  { id: 'google', label: 'Google Services', icon: Globe },
  { id: 'data', label: 'Data Management', icon: Database },
  { id: 'about', label: 'About', icon: Info },
];

export default function SettingsGlass() {
  const [active, setActive] = useState('billing');
  const [appVersion, setAppVersion] = useState('');
  const fileInputRef = useRef(null);
  const { clearHistory } = useStore();

  useEffect(() => {
    if (window.electron?.getAppVersion) {
      window.electron.getAppVersion().then(setAppVersion).catch(() => {});
    }
  }, []);

  const Sidebar = useMemo(
    () => (
      <aside className="w-64 amx-liquid amx-noise amx-p-panel sticky top-6 h-fit">
        <div className="mb-3 text-xs opacity-70 settings-sidebar-title">Settings</div>
        <nav className="space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                active === id
                  ? 'bg-white/15 border border-white/25 text-white'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/90'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </aside>
    ),
    [active]
  );

  const downloadJson = (obj, filename) => {
    const data = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(obj, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', data);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const BillingPanel = () => (
    <div className="amx-liquid amx-noise amx-p-panel">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5" />
        <h2 className="amx-heading text-lg">Billing & Usage</h2>
      </div>
      <SubscriptionManager />
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Tips</div>
          <div className="text-sm">Manage payment method and download invoices from your billing portal.</div>
        </div>
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Usage</div>
          <div className="text-sm">Keep an eye on monthly usage to avoid surprises.</div>
        </div>
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Support</div>
          <div className="text-sm">Need help? Use the in-app feedback or email support.</div>
        </div>
      </div>
    </div>
  );

  const GooglePanel = () => (
    <div className="amx-liquid amx-noise amx-p-panel">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-5 h-5" />
        <h2 className="amx-heading text-lg">Google Services</h2>
      </div>
      <GoogleConnect />
      <div className="mt-4 amx-liquid-nested p-3 rounded-lg text-sm">
        Connect Google to enable calendar, email, and drive workflows. You can revoke access anytime from your Google Account.
      </div>
    </div>
  );

  const DataPanel = () => (
    <div className="amx-liquid amx-noise amx-p-panel">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-5 h-5" />
        <h2 className="amx-heading text-lg">Data Management</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => {
            try {
              const history = JSON.parse(localStorage.getItem('conversationHistory') || '[]');
              downloadJson({ conversationHistory: history }, `agent-max-history-${Date.now()}.json`);
              toast.success('Conversation history exported');
            } catch {
              toast.error('Failed to export');
            }
          }}
          className="flex items-center gap-2 amx-liquid-nested p-3 rounded-lg hover:scale-[1.01] transition"
        >
          <Download className="w-4 h-4" />
          <span>Export Conversation History</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 amx-liquid-nested p-3 rounded-lg hover:scale-[1.01] transition"
        >
          <Upload className="w-4 h-4" />
          <span>Import Conversation History</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = JSON.parse(reader.result);
                if (Array.isArray(parsed?.conversationHistory)) {
                  localStorage.setItem('conversationHistory', JSON.stringify(parsed.conversationHistory));
                  toast.success('Conversation history imported');
                } else {
                  toast.error('Invalid file format');
                }
              } catch {
                toast.error('Import failed');
              }
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />

        <button
          onClick={() => {
            if (!window.confirm('Clear all conversation history?')) return;
            try {
              clearHistory?.();
              localStorage.removeItem('conversationHistory');
              toast.success('Conversation history cleared');
            } catch {
              toast.error('Failed to clear history');
            }
          }}
          className="flex items-center gap-2 amx-liquid-nested p-3 rounded-lg hover:scale-[1.01] transition text-red-300"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Conversation History</span>
        </button>

        <button
          onClick={() => {
            if (!window.confirm('Clear local cache and reload?')) return;
            localStorage.clear();
            toast.success('Cache cleared');
            setTimeout(() => window.location.reload(), 600);
          }}
          className="flex items-center gap-2 amx-liquid-nested p-3 rounded-lg hover:scale-[1.01] transition text-red-300"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Local Cache</span>
        </button>
      </div>
      <div className="mt-4 amx-liquid-nested p-3 rounded-lg text-sm">
        Export generates a JSON file you can back up. Import restores only conversation history.
      </div>
    </div>
  );

  const AboutPanel = () => (
    <div className="amx-liquid amx-noise amx-p-panel">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5" />
        <h2 className="amx-heading text-lg">About</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Version</div>
          <div className="text-sm">{appVersion || '—'}</div>
        </div>
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">Product</div>
          <div className="text-sm">Agent Max Desktop</div>
        </div>
        <div className="amx-liquid-nested p-3 rounded-lg">
          <div className="text-xs opacity-70 mb-1">System</div>
          <div className="text-sm">Memory System V2</div>
        </div>
        <a
          className="amx-liquid-nested p-3 rounded-lg flex items-center gap-2 hover:scale-[1.01] transition"
          href="https://agentmax.app"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Website</span>
        </a>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex gap-5">
        {Sidebar}
        <section className="flex-1 space-y-4">
          {active === 'billing' && <BillingPanel />}
          {active === 'google' && <GooglePanel />}
          {active === 'data' && <DataPanel />}
          {active === 'about' && <AboutPanel />}
        </section>
      </div>
    </div>
  );
}
