/**
 * Message Handler Hook
 * Manages conversation state and API communication
 */
import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { showSuccessWithCost } from '../billing/CostFeedback';
import telemetry from '../../services/telemetry';
import responseCache from '../../services/responseCache';
import { generateConversationSummary } from '../../services/conversationSummary';

export function useMessageHandler() {
  const [message, setMessage] = useState('');
  const [thoughts, setThoughts] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [isStopped, setIsStopped] = useState(false);
  const [partialResponse, setPartialResponse] = useState('');
  const [sessionCost, setSessionCost] = useState(0);
  
  const abortControllerRef = useRef(null);
  const conversationIdRef = useRef(null);

  // Send message to API
  const handleSendMessage = useCallback(async (text) => {
    if (!text.trim() || isThinking) return;

    // Track telemetry
    telemetry.logEvent('message_sent', { 
      length: text.length,
      hasScreenshot: false 
    });

    // Check cache first
    const cachedResponse = responseCache.get(text);
    if (cachedResponse) {
      setThoughts(prev => [
        ...prev,
        { 
          id: Date.now(), 
          type: 'user', 
          label: 'You', 
          message: text 
        },
        { 
          id: Date.now() + 1, 
          type: 'agent', 
          label: 'Agent (cached)', 
          message: cachedResponse 
        }
      ]);
      toast.success('Response from cache');
      return;
    }

    // Start thinking
    setIsThinking(true);
    setThinkingStatus('Connecting to AI...');
    setIsStopped(false);
    setPartialResponse('');
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      label: 'You',
      message: text,
      timestamp: new Date()
    };
    setThoughts(prev => [...prev, userMessage]);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      // Simulate API call (replace with actual API)
      setThinkingStatus('Thinking...');
      
      // TODO: Replace with actual API call
      const response = await mockApiCall(text, abortControllerRef.current.signal);
      
      if (response.success) {
        const agentMessage = {
          id: Date.now(),
          type: 'agent',
          label: 'Agent',
          message: response.message,
          timestamp: new Date(),
          cost: response.cost || 3.00
        };
        
        setThoughts(prev => [...prev, agentMessage]);
        
        // Cache response
        responseCache.set(text, response.message);
        
        // Update cost
        const cost = response.cost || 3.00;
        setSessionCost(prev => prev + cost);
        showSuccessWithCost('Response generated successfully', cost);
        
        // Track success as interaction
        telemetry.logInteraction({
          userPrompt: text,
          aiResponse: response.message,
          success: true,
          executionTime: undefined,
          model: 'desktop',
          metadata: { cost }
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        toast.info('Request cancelled');
      } else {
        toast.error(`Error: ${error.message}`);
        telemetry.logError(error instanceof Error ? error : new Error(String(error)), { 
          severity: 'error'
        });
      }
    } finally {
      setIsThinking(false);
      setThinkingStatus('');
      abortControllerRef.current = null;
    }
  }, [isThinking, sessionCost]);

  // Stop generation
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStopped(true);
      setIsThinking(false);
      toast.info('Generation stopped');
    }
  }, []);

  // Continue generation
  const handleContinue = useCallback(() => {
    if (isStopped && partialResponse) {
      setIsStopped(false);
      // TODO: Implement continue logic
      toast.info('Continuing generation...');
    }
  }, [isStopped, partialResponse]);

  // Clear conversation
  const handleClearConversation = useCallback(() => {
    const clearedData = {
      thoughts: [...thoughts],
      sessionCost,
      timestamp: new Date()
    };
    
    // Store for undo
    sessionStorage.setItem('cleared_conversation', JSON.stringify(clearedData));
    
    // Clear state
    setThoughts([]);
    setMessage('');
    setSessionCost(0);
    
    // Show undo toast
    toast.custom((t) => (
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <span>Conversation cleared</span>
        <button
          onClick={() => {
            const saved = sessionStorage.getItem('cleared_conversation');
            if (saved) {
              const data = JSON.parse(saved);
              setThoughts(data.thoughts);
              setSessionCost(data.sessionCost);
              toast.dismiss(t.id);
              toast.success('Conversation restored');
            }
          }}
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Undo
        </button>
      </div>
    ), { duration: 5000 });
    
    telemetry.logEvent('conversation_cleared');
  }, [thoughts, sessionCost]);

  // Delete single message
  const handleDeleteMessage = useCallback((index) => {
    setThoughts(prev => prev.filter((_, i) => i !== index));
    toast.success('Message deleted');
  }, []);

  // Regenerate message
  const handleRegenerateMessage = useCallback(async (index) => {
    const targetMessage = thoughts[index];
    if (!targetMessage || targetMessage.type !== 'agent') return;
    
    // Find the previous user message
    const userMessageIndex = index - 1;
    const userMessage = thoughts[userMessageIndex];
    if (!userMessage || userMessage.type !== 'user') return;
    
    // Remove the agent message
    setThoughts(prev => prev.slice(0, index));
    
    // Resend the user message
    await handleSendMessage(userMessage.message);
    
    telemetry.trackEvent('message_regenerated');
  }, [thoughts, handleSendMessage]);

  // Copy message
  const handleCopyMessage = useCallback((text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }, []);

  // Generate summary
  const handleGenerateSummary = useCallback(async () => {
    if (thoughts.length < 2) {
      toast.info('Not enough messages for summary');
      return;
    }
    
    const summary = await generateConversationSummary(thoughts);
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
    
    telemetry.trackEvent('summary_generated', { 
      messageCount: thoughts.length 
    });
  }, [thoughts]);

  return {
    // State
    message,
    setMessage,
    thoughts,
    isThinking,
    thinkingStatus,
    isStopped,
    partialResponse,
    sessionCost,
    
    // Actions
    handleSendMessage,
    handleStop,
    handleContinue,
    handleClearConversation,
    handleDeleteMessage,
    handleRegenerateMessage,
    handleCopyMessage,
    handleGenerateSummary
  };
}

// Mock API call for testing
async function mockApiCall(text, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
      } else {
        resolve({
          success: true,
          message: `I received your message: "${text}". This is a test response demonstrating the liquid glass UI components.`,
          cost: 3.00
        });
      }
    }, 2000);
    
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}
