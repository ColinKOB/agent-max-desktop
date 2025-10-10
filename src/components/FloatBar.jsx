import { useState, useEffect, useRef } from 'react';
import { Camera, X, Play, Copy, Minimize2, GripVertical, RotateCcw, Loader2, Sparkles, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import useConnectionStatus from '../hooks/useConnectionStatus';

export default function FloatBar({ showWelcome, onWelcomeComplete, isLoading }) {
  const [isOpen, setIsOpen] = useState(false);
  const [thoughts, setThoughts] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentCommand, setCurrentCommand] = useState('');
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [screenshotData, setScreenshotData] = useState(null); // Store base64 screenshot
  const [welcomeStep, setWelcomeStep] = useState(1);
  const [welcomeData, setWelcomeData] = useState({
    name: '',
    role: '',
    primaryUse: '',
    workStyle: '',
  });
  const inputRef = useRef(null);
  const thoughtsEndRef = useRef(null);
  const { profile } = useStore();
  const { isConnected } = useConnectionStatus();

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

  // Removed automatic preference test - onboarding now works correctly

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

  const handleScreenshot = async () => {
    try {
      if (window.electron?.takeScreenshot) {
        const screenshot = await window.electron.takeScreenshot();
        
        if (screenshot && screenshot.base64) {
          // Store base64 image data
          setScreenshotData(screenshot.base64);
          const sizeKB = Math.round(screenshot.size / 1024);
          console.log(`[FloatBar] Screenshot attached (${sizeKB}KB)`);
          toast.success(`Screenshot attached! 📸 (${sizeKB}KB)`);
        }
      } else {
        toast.error('Screenshot feature not available');
      }
    } catch (error) {
      console.error('[FloatBar] Screenshot error:', error);
      toast.error('Failed to take screenshot');
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    
    // Validation
    if (!trimmedMessage) return;
    
    if (trimmedMessage.length > 2000) {
      toast.error('Message too long (max 2000 characters)');
      return;
    }
    
    if (trimmedMessage.length < 2) {
      toast.error('Message too short (min 2 characters)');
      return;
    }
    
    const userMessage = trimmedMessage;
    
    // Add user message
    setThoughts((prev) => [...prev, { type: 'user', content: userMessage }]);
    setMessage('');
    setIsThinking(true);
    setProgress(0);
    
    try {
      // Import services
      const memoryService = (await import('../services/memory')).default;
      const { chatAPI } = await import('../services/api');
      
      // Initialize if needed
      if (!memoryService.initialized) {
        await memoryService.initialize();
      }
      
      // Show thinking indicator
      setProgress(20);
      const thinkingMsg = screenshotData 
        ? '🤔 Analyzing screenshot and your message...' 
        : '🤔 Processing your request...';
      setThoughts((prev) => [...prev, { type: 'thought', content: thinkingMsg }]);
      
      // Build user context
      setProgress(40);
      const userContext = await memoryService.buildContextForAPI();
      
      // Send to chat API with optional screenshot
      setProgress(60);
      const response = await chatAPI.sendMessage(userMessage, userContext, screenshotData);
      
      setProgress(100);
      
      // Add AI response
      setThoughts((prev) => [...prev, { 
        type: 'agent', 
        content: response.data.response 
      }]);
      
      // Clear screenshot after sending
      if (screenshotData) {
        setScreenshotData(null);
        console.log('[FloatBar] Screenshot sent and cleared');
      }
      
      setIsThinking(false);
      setProgress(0);
      
    } catch (error) {
      console.error('Message send error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to send message';
      let userFriendlyMessage = 'Something went wrong. Please try again.';
      
      if (!error.response && error.code) {
        // Network error with error code
        errorMessage = `Network error: ${error.code}`;
        userFriendlyMessage = `Cannot reach the server (${error.code}). Is the backend running on port 8000?`;
      } else if (!error.response) {
        // Network error without code
        errorMessage = 'Network error';
        userFriendlyMessage = 'Cannot reach the server. Check your connection and backend status.';
      } else if (error.code === 'ECONNABORTED') {
        // Timeout
        errorMessage = 'Request timeout';
        userFriendlyMessage = 'The request took too long. The server might be busy.';
      } else if (error.response.status === 429) {
        // Rate limit
        errorMessage = 'Rate limit exceeded';
        userFriendlyMessage = 'Too many requests. Please wait a moment.';
      } else if (error.response.status >= 500) {
        // Server error
        errorMessage = 'Server error';
        userFriendlyMessage = 'The server encountered an error. Please try again.';
      } else if (error.response.status === 401 || error.response.status === 403) {
        // Auth error
        errorMessage = 'Authentication error';
        userFriendlyMessage = 'Authentication failed. Please check your API key.';
      } else if (error.response?.data?.detail) {
        // API provided error message
        errorMessage = error.response.data.detail;
        userFriendlyMessage = error.response.data.detail;
      }
      
      setThoughts((prev) => [...prev, { 
        type: 'agent', 
        content: `${userFriendlyMessage}` 
      }]);
      setIsThinking(false);
      setProgress(0);
      setScreenshotData(null); // Clear screenshot on error
      toast.error(userFriendlyMessage);
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
      if (showWelcome && welcomeStep === 1) {
        handleWelcomeNext();
      } else {
        handleSendMessage();
      }
    }
  };

  const handleWelcomeNext = () => {
    if (welcomeStep < 4) {
      setWelcomeStep(welcomeStep + 1);
    }
  };

  const handleWelcomeBack = () => {
    if (welcomeStep > 1) {
      setWelcomeStep(welcomeStep - 1);
    }
  };

  const handleWelcomeComplete = async () => {
    try {
      if (window.electron?.memory) {
        console.log('Saving onboarding data:', welcomeData);
        await window.electron.memory.setName(welcomeData.name);
        await window.electron.memory.setPreference('role', welcomeData.role, 'work');
        await window.electron.memory.setPreference('primary_use', welcomeData.primaryUse, 'work');
        await window.electron.memory.setPreference('work_style', welcomeData.workStyle, 'work');
        await window.electron.memory.setPreference('onboarding_completed', 'true', 'system');
        console.log('Onboarding data saved successfully');
      } else {
        console.error('window.electron.memory is not available');
        toast.error('Memory system not available');
        return;
      }
      
      toast.success(`Welcome, ${welcomeData.name}`);
      onWelcomeComplete(welcomeData);
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      toast.error(`Failed to save preferences: ${error.message}`);
    }
  };

  const canProceedWelcome = () => {
    switch (welcomeStep) {
      case 1:
        return welcomeData.name.trim().length > 0;
      case 2:
        return welcomeData.role.length > 0;
      case 3:
        return welcomeData.primaryUse.length > 0;
      case 4:
        return welcomeData.workStyle.length > 0;
      default:
        return false;
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
          placeholder="Ask Max"
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
            {/* Connection status indicator */}
            {!isConnected && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 border border-red-500/30">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Offline</span>
              </div>
            )}
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

        {/* Thoughts stream / Welcome screen */}
        <div className="amx-thoughts" role="status" aria-live="polite">
          {showWelcome ? (
            <div className="amx-welcome">
              <div className="amx-welcome-header">
                <span className="amx-welcome-title">Welcome to Agent Max</span>
              </div>
              <div className="amx-welcome-subtitle">Let's set up your workspace</div>
              
              <div className="amx-welcome-steps">
                {/* Step 1: Name */}
                {welcomeStep === 1 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What's your name?</label>
                    <input
                      type="text"
                      className="amx-welcome-input"
                      placeholder="Enter your name..."
                      value={welcomeData.name}
                      onChange={(e) => setWelcomeData({ ...welcomeData, name: e.target.value })}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                )}

                {/* Step 2: Role */}
                {welcomeStep === 2 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What's your role?</label>
                    <div className="amx-welcome-options">
                      {['Developer', 'Designer', 'Product Manager', 'Researcher', 'Writer', 'Other'].map((opt) => {
                        const value = opt.toLowerCase().replace(' ', '_');
                        return (
                          <button
                            key={value}
                            className={`amx-welcome-option ${welcomeData.role === value ? 'active' : ''}`}
                            onClick={() => setWelcomeData({ ...welcomeData, role: value })}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 3: Primary Use */}
                {welcomeStep === 3 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">What will you use Agent Max for?</label>
                    <div className="amx-welcome-options">
                      {['Code Development', 'Task Automation', 'Research & Analysis', 'Content Creation'].map((opt) => {
                        const value = opt.toLowerCase().replace(/\s+&\s+/, '_').replace(/\s+/g, '_');
                        return (
                          <button
                            key={value}
                            className={`amx-welcome-option ${welcomeData.primaryUse === value ? 'active' : ''}`}
                            onClick={() => setWelcomeData({ ...welcomeData, primaryUse: value })}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 4: Work Style */}
                {welcomeStep === 4 && (
                  <div className="amx-welcome-step">
                    <label className="amx-welcome-label">Preferred response style</label>
                    <div className="amx-welcome-options amx-welcome-options-stacked">
                      {[
                        { value: 'detailed', label: 'Detailed explanations with context' },
                        { value: 'concise', label: 'Brief and to the point' },
                        { value: 'interactive', label: 'Step-by-step guidance' },
                        { value: 'autonomous', label: 'Execute tasks automatically' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          className={`amx-welcome-option amx-welcome-option-stacked ${
                            welcomeData.workStyle === opt.value ? 'active' : ''
                          }`}
                          onClick={() => setWelcomeData({ ...welcomeData, workStyle: opt.value })}
                        >
                          <span className="amx-welcome-option-label">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Welcome navigation */}
              <div className="amx-welcome-nav">
                {welcomeStep > 1 && (
                  <button className="amx-welcome-btn secondary" onClick={handleWelcomeBack}>
                    Back
                  </button>
                )}
                {welcomeStep < 4 ? (
                  <button
                    className={`amx-welcome-btn primary ${!canProceedWelcome() ? 'disabled' : ''}`}
                    onClick={handleWelcomeNext}
                    disabled={!canProceedWelcome()}
                  >
                    Next <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                ) : (
                  <button
                    className={`amx-welcome-btn primary ${!canProceedWelcome() ? 'disabled' : ''}`}
                    onClick={handleWelcomeComplete}
                    disabled={!canProceedWelcome()}
                  >
                    Complete Setup <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                )}
              </div>

              {/* Progress dots */}
              <div className="amx-welcome-progress">
                {[1, 2, 3, 4].map((step) => (
                  <div key={step} className={`amx-welcome-dot ${step <= welcomeStep ? 'active' : ''}`} />
                ))}
              </div>
            </div>
          ) : thoughts.length === 0 ? (
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
            placeholder="Chat with Max"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            disabled={isThinking}
          />
          <button 
            className="amx-send" 
            onClick={handleScreenshot} 
            title="Take Screenshot"
            disabled={isThinking}
            style={{ position: 'relative' }}
          >
            <Camera className="w-4 h-4" />
            {screenshotData && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#7aa2ff',
                border: '2px solid rgba(28, 28, 32, 0.95)',
              }} />
            )}
          </button>
        </div>
        {screenshotData && (
          <div style={{ 
            fontSize: '11px', 
            color: 'rgba(122, 162, 255, 0.8)', 
            textAlign: 'left',
            padding: '4px 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            📸 Screenshot attached
          </div>
        )}
        {message.length > 1800 && (
          <div style={{ 
            fontSize: '11px', 
            color: message.length > 2000 ? '#ff6b6b' : 'rgba(255,255,255,0.5)', 
            textAlign: 'right',
            padding: '4px 16px 0'
          }}>
            {message.length}/2000 characters
          </div>
        )}
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
