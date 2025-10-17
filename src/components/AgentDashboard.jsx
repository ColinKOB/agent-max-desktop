import { useState, useEffect } from 'react';
import { Bot, Plus, Trash2, Send, Loader2, Users, Sparkles, MessageSquare } from 'lucide-react';
import { agentsAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function AgentDashboard() {
  const [agents, setAgents] = useState([]);
  const [providers, setProviders] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [taskInput, setTaskInput] = useState('');
  const [delegating, setDelegating] = useState(false);

  // Create agent form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentRole, setNewAgentRole] = useState('');
  const [newAgentProvider, setNewAgentProvider] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersRes, rolesRes, agentsRes] = await Promise.all([
        agentsAPI.listProviders(),
        agentsAPI.listRoles(),
        agentsAPI.listAgents().catch(() => ({ data: { agents: [] } })),
      ]);

      setProviders(providersRes.data.providers || []);
      setRoles(rolesRes.data.roles || []);
      setAgents(agentsRes.data.agents || []);
    } catch (error) {
      console.error('Failed to load agent data:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentRole) {
      toast.error('Select a role');
      return;
    }

    setCreating(true);
    try {
      const res = await agentsAPI.createAgent(
        newAgentRole,
        newAgentProvider || null,
        null // API keys from environment
      );

      toast.success(`Created ${res.data.agent.role}!`);
      setShowCreateForm(false);
      setNewAgentRole('');
      setNewAgentProvider('');
      await loadData();
    } catch (error) {
      toast.error(`Failed to create agent: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelegateTask = async () => {
    if (!selectedAgent || !taskInput.trim()) return;

    setDelegating(true);
    try {
      const res = await agentsAPI.delegateTask(selectedAgent.id, taskInput);

      toast.success('Task completed!');
      setTaskInput('');

      // Show result
      if (res.data.result?.response) {
        toast.success(res.data.result.response.substring(0, 100), {
          duration: 5000,
        });
      }
    } catch (error) {
      toast.error(`Task delegation failed: ${error.message}`);
    } finally {
      setDelegating(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Delete this agent?')) return;

    try {
      await agentsAPI.deleteAgent(agentId);
      toast.success('Agent deleted');
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      toast.error('Failed to delete agent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-white/95">Agents</span>
            <span className="text-sm text-white/50">({agents.length})</span>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white/90 text-sm font-medium transition-all duration-150"
          >
            <Plus className="w-4 h-4" />
            Create Agent
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="px-5 py-4 border-b border-white/10 space-y-3 bg-white/5">
          <div>
            <label className="text-sm text-white/80 mb-2 block font-medium">Agent Role</label>
            <select
              value={newAgentRole}
              onChange={(e) => setNewAgentRole(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
            >
              <option value="" className="bg-gray-900">Select role...</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id} className="bg-gray-900">
                  {role.name} - {role.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-white/80 mb-2 block font-medium">Provider (optional)</label>
            <select
              value={newAgentProvider}
              onChange={(e) => setNewAgentProvider(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all"
            >
              <option value="" className="bg-gray-900">Default</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id} className="bg-gray-900">
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreateAgent}
              disabled={creating || !newAgentRole}
              className="flex-1 bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-white/30 border border-white/20 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Agent
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 bg-white/5 hover:bg-white/10 border border-white/20 text-white/80 rounded-lg text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Agent List */}
        <div className="w-1/3 border-r border-white/10 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="p-6 text-center text-white/50">
              <Bot className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No agents yet</p>
              <p className="text-xs mt-1 opacity-70">Create your first agent to get started</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all group ${
                    selectedAgent?.id === agent.id
                      ? 'bg-white/20 border border-white/30 text-white'
                      : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-white/70" />
                      <span className="font-semibold">{agent.role}</span>
                    </div>
                    {selectedAgent?.id === agent.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAgent(agent.id);
                        }}
                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete agent"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-white/50">{agent.provider}</div>
                  {agent.tasks_completed > 0 && (
                    <div className="text-xs text-white/40 mt-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {agent.tasks_completed} tasks completed
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Agent Details & Task Delegation */}
        <div className="flex-1 flex flex-col">
          {!selectedAgent ? (
            <div className="flex-1 flex items-center justify-center text-white/50">
              <div className="text-center">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select an agent to delegate tasks</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-white/10 border border-white/20">
                    <Bot className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-white">{selectedAgent.role}</h3>
                    <p className="text-sm text-white/60">{selectedAgent.provider}</p>
                  </div>
                </div>
                {selectedAgent.created_at && (
                  <div className="text-xs text-white/40 mt-2">
                    Created {new Date(selectedAgent.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex-1 p-5 overflow-y-auto">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-white/80 mb-2 block font-medium">Task Description</label>
                    <textarea
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                      placeholder="Describe the task you want this agent to perform...\n\nExample: Analyze the latest market trends in AI and provide a summary of key findings."
                      rows={6}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 transition-all resize-none"
                    />
                  </div>
                  <button
                    onClick={handleDelegateTask}
                    disabled={delegating || !taskInput.trim()}
                    className="w-full bg-white/15 hover:bg-white/25 disabled:bg-white/5 disabled:text-white/30 border border-white/20 text-white py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    {delegating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing Task...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Delegate Task
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
