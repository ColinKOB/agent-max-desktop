import { useEffect, useState } from 'react';
import { Trash2, Plus, CheckCircle } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import useStore from '../store/useStore';
import { conversationAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function Conversation() {
  const { pendingTasks, setPendingTasks, setMessages, sessionId, setSessionId } = useStore();
  const [newTask, setNewTask] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    loadConversationData();
  }, []);

  const loadConversationData = async () => {
    try {
      // Load conversation context
      const contextRes = await conversationAPI.getContext(20, sessionId);
      if (contextRes.data.messages) {
        setMessages(contextRes.data.messages);
      }

      // Load pending tasks
      const tasksRes = await conversationAPI.getTasks(sessionId);
      setPendingTasks(tasksRes.data.tasks || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleAddTask = async () => {
    if (!newTask.trim()) {
      toast.error('Task cannot be empty');
      return;
    }

    try {
      await conversationAPI.addTask(newTask, sessionId);
      setPendingTasks([...pendingTasks, newTask]);
      setNewTask('');
      setIsAddingTask(false);
      toast.success('Task added');
    } catch (error) {
      console.error('Failed to add task:', error);
      toast.error('Failed to add task');
    }
  };

  const handleCompleteTask = async (task) => {
    try {
      await conversationAPI.completeTask(task, sessionId);
      setPendingTasks(pendingTasks.filter(t => t !== task));
      toast.success('Task completed!');
    } catch (error) {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    }
  };

  const handleClearConversation = async () => {
    if (!window.confirm('Are you sure you want to clear the conversation? This cannot be undone.')) {
      return;
    }

    try {
      await conversationAPI.clearConversation(sessionId);
      setMessages([]);
      toast.success('Conversation cleared');
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      toast.error('Failed to clear conversation');
    }
  };

  return (
    <div className="h-full flex">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between bg-white dark:bg-gray-800">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Conversation
          </h1>
          <button
            onClick={handleClearConversation}
            className="btn-secondary flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </div>

      {/* Tasks Sidebar */}
      <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Tasks
            </h2>
            <button
              onClick={() => setIsAddingTask(true)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {isAddingTask && (
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Enter task..."
                className="input w-full"
                autoFocus
              />
              <div className="flex space-x-2">
                <button onClick={handleAddTask} className="btn-primary flex-1 text-sm">
                  Add
                </button>
                <button
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTask('');
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {pendingTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                No pending tasks
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                    {task}
                  </p>
                  <button
                    onClick={() => handleCompleteTask(task)}
                    className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Complete</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
