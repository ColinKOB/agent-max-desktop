import { useState, useEffect, useRef } from 'react';
import { Camera, X, Play, Copy, Minimize2, GripVertical, RotateCcw, Loader2, Sparkles, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import Draggable from 'react-draggable';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

export default function FloatBar({ showWelcome, onWelcomeComplete, isLoading }) {
  const [isOpen, setIsOpen] = useState(false); // Card mode (full chat with conversation)
  const [isMini, setIsMini] = useState(true); // Mini square mode (68x68)
  const [isBar, setIsBar] = useState(false); // Horizontal bar mode (240x68)
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
  
  // Simple connection status check (can be enhanced later)
  const [isConnected, setIsConnected] = useState(true);
  
  // Draggable position state (persists across sessions)
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('agentMaxPosition');
    return saved ? JSON.parse(saved) : { x: 20, y: 20 };
  });
  
  // Semantic suggestions
  const [similarGoals, setSimilarGoals] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Streaming state for fake streaming effect
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Helper: Stream text word-by-word for better perceived speed
  const streamText = async (text, callback) => {
    const words = text.split(' ');
    let displayed = '';
    
    for (let i = 0; i < words.length; i++) {
      displayed += words[i] + (i < words.length - 1 ? ' ' : '');
      callback(displayed);
      await new Promise(resolve => setTimeout(resolve, 40)); // 40ms per word
    }
  };
  
  // Helper: Convert technical reasoning to friendly user-facing text
  const getFriendlyThinking = (step) => {
    const friendlyMap = {
      'analyze_image': 'Looking at your screen',
      'execute_command': 'Running command',
      'respond': 'Thinking',
      'done': 'Complete!'
    };
    
    // Try pre-defined map first
    if (friendlyMap[step.action]) {
      return friendlyMap[step.action];
    }
    
    // Shorten technical phrases
    const reasoning = step.reasoning || '';
    const lowerReasoning = reasoning.toLowerCase();
    
    if (lowerReasoning.includes('check if') || lowerReasoning.includes('checking')) {
      return '🔍 Checking tools';
    }
    if (lowerReasoning.includes('weather') || lowerReasoning.includes('temperature')) {
      return '🌤️ Getting weather';
    }
    if (lowerReasoning.includes('restaurant') || lowerReasoning.includes('food') || lowerReasoning.includes('place')) {
      return '🍽️ Finding places';
    }
    if (lowerReasoning.includes('screenshot') || lowerReasoning.includes('screen')) {
      return '👀 Looking';
    }
    if (lowerReasoning.includes('install') || lowerReasoning.includes('download')) {
      return '📦 Installing';
    }
    if (lowerReasoning.includes('search') || lowerReasoning.includes('find')) {
      return '🔍 Searching';
    }
    
    // Default: Show first 5 words
    const words = reasoning.split(' ').slice(0, 5);
    return words.join(' ') + (reasoning.split(' ').length > 5 ? '...' : '');
  };

  // Window resize handler
  useEffect(() => {
    const resizeWindow = async () => {
      if (window.electron?.resizeWindow) {
        if (isOpen) {
          // Full card mode with conversation
          console.log('[FloatBar] Resizing to CARD mode: 360x520');
          await window.electron.resizeWindow(360, 520);
        } else if (isBar) {
          // Horizontal bar mode (same height as mini square)
          console.log('[FloatBar] Resizing to BAR mode: 320x68');
          await window.electron.resizeWindow(320, 68);
        } else if (isMini) {
          // Mini square mode
          console.log('[FloatBar] Resizing to MINI mode: 68x68');
          await window.electron.resizeWindow(68, 68);
        }
        
        // Debug: Check actual window size after resize
        if (window.electron?.getBounds) {
          const bounds = await window.electron.getBounds();
          console.log('[FloatBar] Actual window bounds after resize:', bounds);
        }
      }
    };
    resizeWindow();
  }, [isOpen, isBar, isMini]);

  // Keep window on screen (boundary checking)
  // Only adjusts position, not size - runs periodically to catch manual drags
  useEffect(() => {
    const checkBoundaries = async () => {
      if (window.electron?.getBounds && window.electron?.setBounds && window.electron?.getScreenSize) {
        try {
          const bounds = await window.electron.getBounds();
          const screenSize = await window.electron.getScreenSize();
          
          let { x, y, width, height } = bounds;
          let changed = false;

          // Ensure window doesn't go off-screen (with 10px margin)
          const margin = 10;
          
          // Right edge
          if (x + width > screenSize.width - margin) {
            x = screenSize.width - width - margin;
            changed = true;
          }
          // Bottom edge
          if (y + height > screenSize.height - margin) {
            y = screenSize.height - height - margin;
            changed = true;
          }
          // Left edge
          if (x < margin) {
            x = margin;
            changed = true;
          }
          // Top edge
          if (y < margin) {
            y = margin;
            changed = true;
          }

          // Only update position if needed (preserve width/height)
          if (changed) {
            console.log('[FloatBar] Adjusting position to stay on screen:', { x, y });
            await window.electron.setBounds({ x, y, width, height });
          }
        } catch (error) {
          console.error('[FloatBar] Boundary check error:', error);
        }
      }
    };

    // Check boundaries periodically (every 2 seconds to catch drags)
    const interval = setInterval(checkBoundaries, 2000);
    
    // Also check immediately on state changes
    checkBoundaries();
    
    return () => clearInterval(interval);
  }, [isOpen, isBar, isMini]);

  // Keyboard shortcut: Cmd+Alt+C (Mac) / Ctrl+Alt+C (Win/Linux)
  useEffect(() => {
    function onHotkey(e) {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        // Toggle through states: mini -> bar -> card
        if (isMini) {
          setIsMini(false);
          setIsBar(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        } else if (isBar) {
          setIsBar(false);
          setIsOpen(true);
        } else {
          setIsOpen(false);
          setIsBar(false);
          setIsMini(true);
        }
      }
      // Escape to collapse to mini
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsBar(false);
        setIsMini(true);
      }
    }
    window.addEventListener('keydown', onHotkey);
    return () => window.removeEventListener('keydown', onHotkey);
  }, [isOpen, isBar, isMini]);

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
    
    // Add user message to UI
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
      
      // 🔥 SAVE USER MESSAGE TO MEMORY (for conversation history)
      await memoryService.addMessage('user', userMessage);
      
      // Show thinking indicator (friendly!)
      setProgress(20);
      const thinkingMsg = screenshotData 
        ? '👀 Looking at your screenshot...' 
        : '💭 Thinking...';
      setThoughts((prev) => [...prev, { type: 'thought', content: thinkingMsg }]);
      
      // Build user context (now includes recent messages!)
      setProgress(40);
      const userContext = await memoryService.buildContextForAPI();
      
      // 🔥 SEMANTIC CONTEXT: If we have high-similarity past conversations, include them
      if (similarGoals.length > 0 && similarGoals[0].similarity >= 0.70) {
        const topMatch = similarGoals[0];
        console.log(`[Semantic] High similarity (${(topMatch.similarity * 100).toFixed(0)}%) - Adding context`);
        
        // Add semantic context to user_context
        userContext.semantic_context = {
          similar_question: topMatch.goal,
          similarity_score: topMatch.similarity,
          was_successful: topMatch.success,
          note: 'User asked something very similar before. Use this for context.'
        };
      }
      
      // Send to autonomous API with optional screenshot
      setProgress(60);
      const response = await chatAPI.sendMessage(userMessage, userContext, screenshotData);
      
      setProgress(100);
      setIsConnected(true); // Mark as connected on successful response
      
      // Autonomous endpoint returns: final_response, steps, status, execution_time
      const aiResponse = response.data.final_response || response.data.response || 'No response';
      
      // 🔥 SAVE AI RESPONSE TO MEMORY (for conversation history)
      await memoryService.addMessage('assistant', aiResponse);
      
      // 🔥 EXTRACT AND SAVE FACTS if provided by backend
      if (response.data.facts_extracted && Object.keys(response.data.facts_extracted).length > 0) {
        const facts = response.data.facts_extracted;
        console.log('[Memory] Facts extracted by backend:', facts);
        
        // Save each category of facts
        let factCount = 0;
        for (const [category, data] of Object.entries(facts)) {
          if (data && typeof data === 'object') {
            for (const [key, value] of Object.entries(data)) {
              try {
                await memoryService.setFact(category, key, value);
                console.log(`[Memory] ✓ Saved fact: ${category}.${key} = ${JSON.stringify(value)}`);
                factCount++;
              } catch (error) {
                console.error(`[Memory] ✗ Failed to save fact ${category}.${key}:`, error);
              }
            }
          }
        }
        
        if (factCount > 0) {
          toast.success(`Learned ${factCount} new thing${factCount > 1 ? 's' : ''} about you!`, {
            icon: '🧠',
            duration: 3000
          });
        }
      }
      
      // Add AI response to UI with streaming effect
      setIsStreaming(true);
      
      // Add placeholder for streaming response
      const responseIndex = thoughts.length;
      setThoughts((prev) => [...prev, { 
        type: 'agent', 
        content: ''
      }]);
      
      // Stream the response word-by-word
      await streamText(aiResponse, (partial) => {
        setThoughts((prev) => {
          const newThoughts = [...prev];
          // Update the last thought (the placeholder we added)
          if (newThoughts.length > 0) {
            newThoughts[newThoughts.length - 1] = {
              type: 'agent',
              content: partial
            };
          }
          return newThoughts;
        });
      });
      
      setIsStreaming(false);
      
      // Show detailed execution steps with friendly text
      if (response.data.steps && response.data.steps.length > 0) {
        response.data.steps.forEach((step, idx) => {
          // Show reasoning for each step (now friendly!)
          if (step.reasoning) {
            const friendlyText = getFriendlyThinking(step);
            setThoughts((prev) => [...prev, { 
              type: 'thought', 
              content: `Step ${idx + 1}: ${friendlyText}`
            }]);
          }
          
          // Show command execution with FULL output
          if (step.action === 'execute_command' && step.command) {
            setThoughts((prev) => [...prev, { 
              type: 'debug', 
              content: `🔧 Executing: ${step.command}`
            }]);
            
            // Show full command output (not truncated)
            if (step.output) {
              setThoughts((prev) => [...prev, { 
                type: 'debug', 
                content: `📤 Output:\n${step.output}`
              }]);
            }
            
            // Show exit code
            if (step.exit_code !== undefined) {
              const statusEmoji = step.exit_code === 0 ? '✅' : '❌';
              setThoughts((prev) => [...prev, { 
                type: step.exit_code === 0 ? 'debug' : 'error', 
                content: `${statusEmoji} Exit code: ${step.exit_code}`
              }]);
            }
          }
          
          // Show other action types
          if (step.action !== 'execute_command' && step.action !== 'respond') {
            setThoughts((prev) => [...prev, { 
              type: 'debug', 
              content: `🔄 Action: ${step.action}${step.result ? '\nResult: ' + step.result : ''}`
            }]);
          }
        });
      }
      
      // Show execution summary
      const summaryInfo = [];
      if (response.data.execution_time) {
        summaryInfo.push(`⏱️  Completed in ${response.data.execution_time.toFixed(1)}s`);
      }
      if (response.data.steps && response.data.steps.length > 0) {
        summaryInfo.push(`📊 Total steps: ${response.data.steps.length}`);
      }
      if (screenshotData) {
        summaryInfo.push('📸 Screenshot was analyzed');
      }
      
      if (summaryInfo.length > 0) {
        setThoughts((prev) => [...prev, { 
          type: 'debug', 
          content: summaryInfo.join('\n')
        }]);
      }
      
      // Clear screenshot after sending
      if (screenshotData) {
        setScreenshotData(null);
        console.log('[FloatBar] Screenshot sent and cleared');
      }
      
      setIsThinking(false);
      setProgress(0);
      
    } catch (error) {
      console.error('[FloatBar] Message send error:', error);
      setIsThinking(false);
      setProgress(0);
      
      // Generate helpful error message based on error type
      let errorMsg = 'Failed to send message';
      let errorDetail = '';
      
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        errorMsg = 'Cannot connect to backend';
        errorDetail = 'The API server is not running. Please start it with:\ncd Agent_Max && ./start_api.sh';
        setIsConnected(false); // Update connection status
      } else if (error.response?.status === 404) {
        errorMsg = 'API endpoint not found';
        errorDetail = 'The backend may be outdated. Check that you have the latest version.';
      } else if (error.response?.status === 500) {
        errorMsg = 'Backend error';
        const detail = error.response?.data?.detail || error.response?.data?.final_response;
        errorDetail = detail || 'Internal server error';
        // Add full error details for debugging
        if (error.response?.data) {
          errorDetail += '\n\nFull error: ' + JSON.stringify(error.response.data, null, 2);
        }
      } else if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        errorMsg = 'Request timed out';
        errorDetail = 'The server is taking too long to respond. Try a simpler request.';
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        errorMsg = 'Authentication failed';
        errorDetail = 'Check your API key in settings.';
      } else if (error.response?.status === 429) {
        errorMsg = 'Rate limit exceeded';
        errorDetail = 'Too many requests. Please wait a moment and try again.';
      } else {
        errorDetail = error.message || 'Unknown error occurred';
        // Add full error for debugging
        if (error.response) {
          errorDetail += '\n\nStatus: ' + error.response.status;
          errorDetail += '\nData: ' + JSON.stringify(error.response.data, null, 2);
        }
      }
      
      // Add error to thoughts
      setThoughts((prev) => [...prev, { 
        type: 'error', 
        content: `${errorMsg}${errorDetail ? '\n' + errorDetail : ''}` 
      }]);
      
      // Clear screenshot on error
      setScreenshotData(null);
      
      // Show toast notification
      toast.error(errorMsg, { 
        duration: 5000,
        style: {
          background: '#ef4444',
          color: '#fff',
        }
      });
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

  // Convert URLs in text to clickable links
  const renderMessageWithLinks = (text) => {
    if (!text) return null;
    
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={index}
            href={part} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              color: '#7aa2ff',
              textDecoration: 'underline',
              cursor: 'pointer',
              wordBreak: 'break-all'
            }}
            onClick={(e) => {
              e.preventDefault();
              if (window.electron?.openExternal) {
                window.electron.openExternal(part);
              } else {
                window.open(part, '_blank');
              }
            }}
          >
            {part}
          </a>
        );
      }
      return part;
    });
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

  // Fetch similar goals as user types (debounced)
  useEffect(() => {
    if (!message || message.trim().length < 3) {
      setSimilarGoals([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { semanticAPI } = await import('../services/api');
        const response = await semanticAPI.findSimilar(message.trim(), 0.7, 3);
        
        if (response.data.similar_goals && response.data.similar_goals.length > 0) {
          setSimilarGoals(response.data.similar_goals);
          setShowSuggestions(true);
        } else {
          setSimilarGoals([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.log('[Semantic] Could not fetch similar goals:', error.message);
        setSimilarGoals([]);
        setShowSuggestions(false);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timer);
  }, [message]);

  // Mini square mode - fully collapsed
  if (isMini) {
    return (
      <Draggable
        position={position}
        onStop={(e, data) => {
          const newPos = { x: data.x, y: data.y };
          setPosition(newPos);
          localStorage.setItem('agentMaxPosition', JSON.stringify(newPos));
        }}
        bounds="parent"
        handle=".amx-mini-content"
      >
        <div className="amx-root amx-mini" style={{ position: 'fixed', cursor: 'move', userSelect: 'none' }}>
          <div 
            className="amx-mini-content"
            style={{ 
              userSelect: 'none', 
              WebkitUserSelect: 'none',
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => {
              // Only expand if not dragging
              if (!e.defaultPrevented) {
                // Open to horizontal bar mode
                console.log('[FloatBar] Mini clicked: Opening to bar mode');
                setIsMini(false);
                setIsBar(true);
                setIsOpen(false);
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
          >
            <img 
              src="/AgentMaxLogo.png" 
              alt="Agent Max" 
              style={{ 
                width: '48px', 
                height: '48px', 
                userSelect: 'none',
                WebkitUserDrag: 'none',
                pointerEvents: 'none'
              }}
              draggable={false}
            />
          </div>
        </div>
      </Draggable>
    );
  }

  // Horizontal bar mode - input bar (same height as mini)
  if (isBar) {
    return (
      <div className="amx-root amx-bar">
        <input
          ref={inputRef}
          className="amx-bar-input"
          placeholder="Ask MAX..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => {
            // Expand to full chat if there's conversation
            if (thoughts.length > 0) {
              setIsBar(false);
              setIsOpen(true);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && message.trim()) {
              // Hide suggestions and send message
              setShowSuggestions(false);
              // Send and expand to full chat
              setIsBar(false);
              setIsOpen(true);
              handleSendMessage();
            }
          }}
        />
        <button
          className="amx-bar-minimize-btn"
          onClick={() => {
            console.log('[FloatBar] Bar minimize clicked: Going to mini');
            setIsBar(false);
            setIsMini(true);
          }}
          title="Minimize"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
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
            <button 
              className="amx-icon-btn" 
              onClick={() => {
                console.log('[FloatBar] Card minimize clicked: Going to mini');
                setIsOpen(false);
                setIsBar(false);
                setIsMini(true);
              }}
              title="Minimize (Esc)"
            >
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
                  {thought.type === 'thought' && <span className="amx-thought-label">Thinking</span>}
                  {thought.type === 'debug' && <span className="amx-debug-label">Debug Info</span>}
                  {thought.type === 'error' && <span className="amx-error-label">Error</span>}
                  <div className="amx-message-content" style={{ whiteSpace: 'pre-wrap' }}>
                    {renderMessageWithLinks(thought.content)}
                  </div>
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
        
        {/* Semantic suggestions */}
        {showSuggestions && similarGoals.length > 0 && (
          <div className="amx-suggestions">
            <div className="amx-suggestions-label">💡 Similar past conversations:</div>
            {similarGoals.map((goal, idx) => (
              <div 
                key={idx}
                className="amx-suggestion-item"
                onClick={() => {
                  setMessage(goal.goal);
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
              >
                <div className="amx-suggestion-text">{goal.goal}</div>
                <div className="amx-suggestion-meta">
                  {Math.round(goal.similarity * 100)}% similar
                  {goal.success && ' ✓'}
                </div>
              </div>
            ))}
          </div>
        )}
        
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
