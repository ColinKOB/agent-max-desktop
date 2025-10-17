import { Users, X } from 'lucide-react';
import AgentDashboard from '../components/AgentDashboard';

export default function ToolsPanel({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Glass backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Glass container - matches chat card aesthetic */}
      <div className="amx-tools-card relative w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header with drag handle */}
        <div className="amx-tools-header flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-white/20 to-white/10 border border-white/20">
              <Users className="w-5 h-5 text-white/90" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white/95 tracking-tight">AI Agents</h2>
              <p className="text-xs text-white/60">Create and manage autonomous agents</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="amx-close-btn p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white/90 transition-all duration-150"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AgentDashboard />
        </div>
      </div>
    </div>
  );
}
