import { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Brain,
  Zap,
  Shield,
  Globe,
  Code,
  MessageSquare,
  FileSearch,
  Database,
  Cloud,
  Lock,
  ChevronRight,
  Plus,
  X,
  Check,
  Loader2,
  Info,
  Star,
  Cpu,
  Layers,
} from 'lucide-react';
import { agentsAPI } from '../services/api';
import toast from 'react-hot-toast';
import '../styles/premium-glass.css';

const agentTemplates = [
  {
    id: 'researcher',
    name: 'Research Assistant',
    icon: FileSearch,
    description: 'Analyzes data and provides insights',
    capabilities: ['Web Search', 'Data Analysis', 'Report Generation'],
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'developer',
    name: 'Code Assistant',
    icon: Code,
    description: 'Helps with programming and debugging',
    capabilities: ['Code Review', 'Bug Fixing', 'Documentation'],
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'analyst',
    name: 'Data Analyst',
    icon: Database,
    description: 'Processes and visualizes data',
    capabilities: ['SQL Queries', 'Visualization', 'Statistical Analysis'],
    gradient: 'from-green-500 to-teal-500',
  },
  {
    id: 'writer',
    name: 'Content Writer',
    icon: MessageSquare,
    description: 'Creates and edits content',
    capabilities: ['Blog Posts', 'Documentation', 'Copy Editing'],
    gradient: 'from-orange-500 to-red-500',
  },
];

const providerOptions = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: ['GPT-4', 'GPT-3.5 Turbo'],
    icon: Brain,
    color: 'from-green-400 to-blue-500',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['Claude 3 Opus', 'Claude 3 Sonnet'],
    icon: Sparkles,
    color: 'from-purple-400 to-pink-500',
  },
  {
    id: 'local',
    name: 'Local LLM',
    models: ['Llama 2', 'Mistral'],
    icon: Cpu,
    color: 'from-orange-400 to-red-500',
  },
];

const StepIndicator = ({ currentStep, totalSteps }) => (
  <div className="flex items-center gap-2 mb-8">
    {[...Array(totalSteps)].map((_, i) => (
      <div key={i} className="flex items-center">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all duration-300
            ${i < currentStep 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
              : i === currentStep
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white animate-pulse'
              : 'bg-white/10 text-white/50 border border-white/20'
            }
          `}
        >
          {i < currentStep ? <Check className="w-5 h-5" /> : i + 1}
        </div>
        {i < totalSteps - 1 && (
          <div 
            className={`w-12 h-0.5 transition-all duration-300 ${
              i < currentStep ? 'bg-white/40' : 'bg-white/10'
            }`}
          />
        )}
      </div>
    ))}
  </div>
);

export default function CreateAgentPremium({ onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  
  // Agent configuration
  const [agentConfig, setAgentConfig] = useState({
    template: null,
    name: '',
    description: '',
    provider: null,
    model: '',
    capabilities: [],
    advanced: {
      temperature: 0.7,
      maxTokens: 2000,
      memoryEnabled: true,
      webAccess: false,
      codeExecution: false,
    },
  });

  const handleTemplateSelect = (template) => {
    setAgentConfig(prev => ({
      ...prev,
      template: template.id,
      name: template.name,
      description: template.description,
      capabilities: template.capabilities,
    }));
    setStep(1);
  };

  const handleProviderSelect = (provider) => {
    setAgentConfig(prev => ({
      ...prev,
      provider: provider.id,
      model: provider.models[0],
    }));
    setStep(2);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const response = await agentsAPI.createAgent(
        agentConfig.template,
        agentConfig.provider,
        {
          name: agentConfig.name,
          description: agentConfig.description,
          model: agentConfig.model,
          ...agentConfig.advanced,
        }
      );
      
      toast.success(`Agent "${agentConfig.name}" created successfully!`);
      if (onSuccess) onSuccess(response.data.agent);
      if (onClose) onClose();
    } catch (error) {
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch(step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Choose a Template</h2>
              <p className="text-white/60">Select a pre-configured agent template to get started</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {agentTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="premium-template-card group"
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${template.gradient} opacity-20 group-hover:opacity-30 transition-opacity`} />
                  <div className="absolute inset-0 p-6 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <template.icon className="w-8 h-8 text-white" />
                      <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-2">{template.name}</h3>
                    <p className="text-white/70 text-sm mb-4 flex-1">{template.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {template.capabilities.map((cap, i) => (
                        <span 
                          key={i}
                          className="px-2 py-1 rounded-full bg-white/10 text-white/80 text-xs"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                setAgentConfig(prev => ({ ...prev, template: 'custom' }));
                setStep(1);
              }}
              className="w-full p-4 rounded-xl border-2 border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all flex items-center justify-center gap-3 text-white/70 hover:text-white"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create Custom Agent</span>
            </button>
          </div>
        );
        
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Select AI Provider</h2>
              <p className="text-white/60">Choose the AI model that powers your agent</p>
            </div>
            
            <div className="space-y-3">
              {providerOptions.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider)}
                  className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${provider.color} opacity-20 group-hover:opacity-30`}>
                        <provider.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-white font-semibold mb-1">{provider.name}</h3>
                        <div className="flex gap-2">
                          {provider.models.map((model, i) => (
                            <span key={i} className="text-xs text-white/60">
                              {model}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white" />
                  </div>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setStep(0)}
              className="w-full p-3 text-white/70 hover:text-white transition-colors"
            >
              ← Back to Templates
            </button>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Configure Your Agent</h2>
              <p className="text-white/60">Fine-tune your agent's capabilities and behavior</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={agentConfig.name}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
                  placeholder="Enter agent name"
                />
              </div>
              
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={agentConfig.description}
                  onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all resize-none"
                  rows={3}
                  placeholder="Describe what your agent does"
                />
              </div>
              
              <div>
                <label className="block text-white/80 text-sm font-medium mb-3">
                  Advanced Settings
                </label>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-white/60" />
                      <div>
                        <p className="text-white text-sm font-medium">Web Access</p>
                        <p className="text-white/60 text-xs">Allow searching and browsing the web</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAgentConfig(prev => ({
                        ...prev,
                        advanced: { ...prev.advanced, webAccess: !prev.advanced.webAccess }
                      }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        agentConfig.advanced.webAccess 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                          : 'bg-white/20'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        agentConfig.advanced.webAccess ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <Code className="w-5 h-5 text-white/60" />
                      <div>
                        <p className="text-white text-sm font-medium">Code Execution</p>
                        <p className="text-white/60 text-xs">Run and test code snippets</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAgentConfig(prev => ({
                        ...prev,
                        advanced: { ...prev.advanced, codeExecution: !prev.advanced.codeExecution }
                      }))}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        agentConfig.advanced.codeExecution 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-500' 
                          : 'bg-white/20'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        agentConfig.advanced.codeExecution ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all"
              >
                Back
              </button>
              
              <button
                onClick={handleCreate}
                disabled={creating || !agentConfig.name}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Agent...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Create Agent
                  </>
                )}
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="w-full max-w-2xl">
        <div className="premium-create-agent-modal">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/70 hover:text-white" />
          </button>
          
          <StepIndicator currentStep={step} totalSteps={3} />
          
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

<style jsx>{`
  .premium-create-agent-modal {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(40px);
    -webkit-backdrop-filter: blur(40px);
    border-radius: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 2rem;
    position: relative;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .premium-template-card {
    position: relative;
    min-height: 200px;
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    overflow: hidden;
    cursor: pointer;
  }
  
  .premium-template-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }
`}</style>
