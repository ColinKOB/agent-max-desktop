import { useState, useEffect, useRef } from 'react';
import { Send, X, Play, Copy, Minimize2, GripVertical, RotateCcw, Loader2 } from 'lucide-react';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

export default function FloatBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [thoughts, setThoughts] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentCommand, setCurrentCommand] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const inputRef = useRef(null);
  const thoughtsEndRef = useRef(null);
  const { profile } = useStore();

  // Window resize handler
  useEffect(() => {
    const resizeWindow = async () => {
      if (window.electron?.resizeWindow) {
        if (isOpen) {
          await window.electron.resizeWindow(360, 520);
        } else {
          await window.electron.resizeWindow(360, 80);
        }
      }
    };
    resizeWindow();
  }, [isOpen]);

  // Keyboard shortcut: Cmd+Alt+C (Mac) / Ctrl+Alt+C (Win/Linux)
  useEffect(() => {
    function onHotkey(e) {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to collapse
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', onHotkey);
    return () => window.removeEventListener('keydown', onHotkey);
  }, [isOpen]);

  // SSE streaming (placeholder - connect to your backend)
  useEffect(() => {
    if (!isOpen) return;
    
    // Example SSE connection - adjust URL to your backend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    
    // Uncomment when backend streaming endpoint is ready
    /*
    const es = new EventSource(`${apiUrl}/v1/chat/stream`, { withCredentials: true });
    
    es.addEventListener('thought', (e) => {
      setThoughts((prev) => [...prev, e.data]);
    });
    
    es.addEventListener('progress', (e) => {
      setProgress(Number(e.data));
    });
    
    es.addEventListener('final', (e) => {
      const data = JSON.parse(e.data);
      if (data.command) {
        setCurrentCommand(data.command);
      }
    });
    
    es.onerror = () => {
      es.close();
    };
    
    return () => {
      es.close();
    };
    */
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message;
    
    // Add user message
    setThoughts((prev) => [...prev, { type: 'user', content: userMessage }]);
    setMessage('');
    setIsThinking(true);
    setProgress(0);
    
    try {
      // Import memory service
      const memoryService = (await import('../services/memory')).default;
      const api = (await import('../services/api')).default;
      
      // Initialize if needed
      if (!memoryService.initialized) {
        await memoryService.initialize();
      }
      
      // Show thinking indicator
      setProgress(20);
      setThoughts((prev) => [...prev, { type: 'thought', content: '🤔 Processing your request...' }]);
      
      // Send to autonomous AI
      setProgress(40);
      const response = await memoryService.sendMessageWithContext(userMessage, api);
      
      setProgress(100);
      
      // Add AI response
      setThoughts((prev) => [...prev, { 
        type: 'agent', 
        content: response.response 
      }]);
      
      // Show execution time
      if (response.execution_time) {
        setThoughts((prev) => [...prev, { 
          type: 'thought', 
          content: `⏱️ Completed in ${response.execution_time.toFixed(2)}s` 
        }]);
      }
      
      setIsThinking(false);
      setProgress(0);
      
    } catch (error) {
      console.error('Message send error:', error);
      setThoughts((prev) => [...prev, { 
        type: 'agent', 
        content: `❌ Error: ${error.message || 'Failed to send message'}` 
      }]);
      setIsThinking(false);
      setProgress(0);
      toast.error('Failed to send message');
    }
  };

  const handleResetConversation = () => {
    setThoughts([]);
    setProgress(0);
    setCurrentCommand('');
    setMessage('');
    setIsThinking(false);
    toast.success('Conversation reset');
  };

  const handleRunCommand = () => {
    if (!currentCommand) return;
    setShowConfirmModal(true);
  };

  const confirmRunCommand = async () => {
    if (window.electron?.executeCommand) {
      const result = await window.electron.executeCommand(currentCommand);
      if (result.success) {
        toast.success('Command executed in terminal');
        setThoughts((prev) => [...prev, `✓ Executed: ${currentCommand}`]);
      } else {
        toast.error(`Failed: ${result.message}`);
      }
    } else {
      toast.error('Command execution not available');
    }
    setShowConfirmModal(false);
  };

  const handleCopyCommand = async () => {
    if (window.electron?.copyToClipboard) {
      await window.electron.copyToClipboard(currentCommand);
      toast.success('Copied to clipboard');
    } else {
      navigator.clipboard.writeText(currentCommand);
      toast.success('Copied to clipboard');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new thoughts arrive
  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);

  if (!isOpen) {
    // Inactive: Pill mode
    return (
      <div className="amx-root amx-pill">
        <div className="amx-drag-handle-pill">
          <GripVertical className="w-5 h-5 text-white/40" />
        </div>
        <input
          ref={inputRef}
          className="amx-input"
          placeholder="Ask Agent Max…"
          onFocus={() => setIsOpen(true)}
        />
      </div>
    );
  }

  // Active: Card mode
  return (
    <div className="amx-root amx-card">
      <div className="amx-panel">
        {/* Header with drag handle */}
        <div className="amx-header amx-drag-handle">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-white/40" />
            <span>Hi, {profile?.name || 'there'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="amx-icon-btn" 
              onClick={handleResetConversation} 
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button className="amx-icon-btn" onClick={() => setIsOpen(false)} title="Minimize (Esc)">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thoughts stream */}
        <div className="amx-thoughts" role="status" aria-live="polite">
          {thoughts.length === 0 ? (
            <div className="amx-empty-state">
              <div className="amx-empty-icon">💬</div>
              <div className="amx-empty-text">Start a conversation...</div>
            </div>
          ) : (
            <>
              {thoughts.map((thought, i) => (
                <div 
                  key={i} 
                  className={`amx-message amx-message-${thought.type}`}
                >
                  {thought.type === 'user' && <span className="amx-message-label">You</span>}
                  {thought.type === 'agent' && <span className="amx-message-label">Agent Max</span>}
                  {thought.type === 'thought' && <span className="amx-thought-label">💭 Thinking</span>}
                  <div className="amx-message-content">{thought.content}</div>
                </div>
              ))}
              {isThinking && (
                <div className="amx-thinking-indicator">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Agent Max is thinking...</span>
                </div>
              )}
              <div ref={thoughtsEndRef} />
            </>
          )}
        </div>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="amx-progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Command preview */}
        {currentCommand && (
          <div className="amx-cmd">
            <code className="amx-code">{currentCommand}</code>
            <div className="amx-actions">
              <button onClick={handleRunCommand} className="amx-btn" title="Run command">
                <Play className="w-3 h-3" />
                Run
              </button>
              <button onClick={handleCopyCommand} className="amx-btn" title="Copy to clipboard">
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Message compose */}
        <div className="amx-compose">
          <input
            className="amx-input"
            placeholder="Type a message… (Shift+Enter = newline)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="amx-send" onClick={handleSendMessage} title="Send (Enter)">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <div className="amx-modal">
          <div className="amx-modal-content">
            <h3 className="amx-modal-title">Execute Command?</h3>
            <p className="amx-modal-text">
              This will run the following command in your terminal:
            </p>
            <code className="amx-modal-code">{currentCommand}</code>
            <div className="amx-modal-actions">
              <button onClick={() => setShowConfirmModal(false)} className="amx-btn-secondary">
                Cancel
              </button>
              <button onClick={confirmRunCommand} className="amx-btn-primary">
                Run Command
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
