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
        agentsAPI.listAgents().catch(() => ({ data: { agents: [] } }))
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
      toast.error('Failed to create agent: ' + error.message);
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
          duration: 5000
        });
      }
    } catch (error) {
      toast.error('Task delegation failed: ' + error.message);
    } finally {
      setDelegating(false);
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Delete this agent?')) return;
    
    try {
      await agentsAPI.deleteAgent(agentId);
      toast.success('Agent deleted');
      setAgents(prev => prev.filter(a => a.id !== agentId));
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      toast.error('Failed to delete agent');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-semibold">AI Agents</h2>
            <span className="text-xs text-gray-400">({agents.length})</span>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Create
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-gray-800 border-b border-gray-700 p-3 space-y-2">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Role</label>
            <select
              value={newAgentRole}
              onChange={(e) => setNewAgentRole(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs"
            >
              <option value="">Select role...</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>
                  {role.name} - {role.description}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Provider (optional)</label>
            <select
              value={newAgentProvider}
              onChange={(e) => setNewAgentProvider(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs"
            >
              <option value="">Default</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleCreateAgent}
              disabled={creating || !newAgentRole}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-1.5 rounded text-xs flex items-center justify-center gap-1"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Create Agent
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 bg-gray-700 hover:bg-gray-600 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Agent List */}
        <div className="w-1/3 border-r border-gray-700 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-xs">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No agents yet. Create one!
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`w-full text-left p-2 rounded text-xs transition-colors ${
                    selectedAgent?.id === agent.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{agent.role}</span>
                    {selectedAgent?.id === agent.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAgent(agent.id);
                        }}
                        className="p-1 hover:bg-red-600 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {agent.provider}
                  </div>
                  {agent.tasks_completed > 0 && (
                    <div className="text-[10px] text-gray-500 mt-1">
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
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
              Select an agent to delegate tasks
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm">{selectedAgent.role}</span>
                </div>
                <div className="text-xs text-gray-400">
                  {selectedAgent.provider}
                </div>
                {selectedAgent.created_at && (
                  <div className="text-[10px] text-gray-500 mt-1">
                    Created {new Date(selectedAgent.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex-1 p-3">
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 block">Delegate Task</label>
                  <textarea
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    placeholder="e.g., Analyze market trends in AI..."
                    rows={4}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs"
                  />
                  <button
                    onClick={handleDelegateTask}
                    disabled={delegating || !taskInput.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2 rounded text-xs font-medium flex items-center justify-center gap-2"
                  >
                    {delegating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
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
