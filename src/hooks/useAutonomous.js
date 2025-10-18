/**
 * useAutonomous Hook
 * 
 * React hook for managing autonomous execution state and WebSocket connection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AutonomousWebSocket from '../services/autonomousWebSocket';

export function useAutonomous() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, connecting, reconnecting, running, complete, error
  const [currentAction, setCurrentAction] = useState(null);
  const [steps, setSteps] = useState([]);
  const [reconnectInfo, setReconnectInfo] = useState(null); // { attempt, delay }
  const [error, setError] = useState(null);
  
  const wsRef = useRef(null);

  /**
   * Initialize WebSocket connection
   */
  const connect = useCallback(async () => {
    if (wsRef.current?.connected) {
      console.log('[useAutonomous] Already connected');
      return;
    }
    
    setStatus('connecting');
    setError(null);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      wsRef.current = new AutonomousWebSocket(apiUrl);
      
      // Set up event listeners
      wsRef.current.on('connected', () => {
        console.log('[useAutonomous] Connected');
        setConnected(true);
        setStatus('active');
        setReconnectInfo(null);
      });
      
      wsRef.current.on('disconnected', () => {
        console.log('[useAutonomous] Disconnected');
        setConnected(false);
        // Don't set error status immediately - might be reconnecting
      });
      
      wsRef.current.on('reconnecting', (info) => {
        console.log('[useAutonomous] Reconnecting...', info);
        setStatus('reconnecting');
        setReconnectInfo(info);
      });
      
      wsRef.current.on('reconnected', () => {
        console.log('[useAutonomous] Reconnected successfully');
        setConnected(true);
        setStatus('active');
        setReconnectInfo(null);
      });
      
      wsRef.current.on('reconnect-failed', () => {
        console.log('[useAutonomous] Reconnection failed');
        setConnected(false);
        setStatus('error');
        setReconnectInfo(null);
      });
      
      wsRef.current.on('action', async (actionData) => {
        console.log('[useAutonomous] Action received:', actionData.action.type);
        setCurrentAction(actionData);
        setStatus('running');
        
        // Add to steps list
        setSteps(prev => [...prev, {
          stepId: actionData.stepId,
          seq: actionData.seq,
          action: actionData.action,
          policy: actionData.policy,
          status: 'executing',
          startedAt: new Date().toISOString()
        }]);

        // Execute action via Electron IPC
        try {
          const executionResult = await window.electron.autonomous.execute(
            actionData.stepId,
            actionData.action,
            actionData.policy
          );
          
          // Send result back to server
          await wsRef.current.sendResult(
            actionData.stepId,
            executionResult.success,
            executionResult.result
          );
          
          // Acknowledge step after successful result send (for resume capability)
          wsRef.current.acknowledgeStep(actionData.stepId, actionData.conversationId);
          
          // Update step status
          setSteps(prev => prev.map(step => 
            step.stepId === actionData.stepId
              ? {
                  ...step,
                  status: executionResult.success ? 'success' : 'failed',
                  result: executionResult.result,
                  completedAt: new Date().toISOString()
                }
              : step
          ));
          
        } catch (error) {
          console.error('[useAutonomous] Execution error:', error);
          
          // Send failure result
          await wsRef.current.sendResult(
            actionData.stepId,
            false,
            { error: { code: 'EXECUTION_ERROR', message: error.message } }
          );
          
          // Still acknowledge the step (even on error) to prevent re-execution
          wsRef.current.acknowledgeStep(actionData.stepId, actionData.conversationId);
          
          // Update step status
          setSteps(prev => prev.map(step => 
            step.stepId === actionData.stepId
              ? {
                  ...step,
                  status: 'failed',
                  error: error.message,
                  completedAt: new Date().toISOString()
                }
              : step
          ));
        }
        
        setCurrentAction(null);
      });
      
      wsRef.current.on('finish', (finishData) => {
        console.log('[useAutonomous] Conversation finished:', finishData);
        setStatus('complete');
        setCurrentAction(null);
        // Clear conversation state on completion
        wsRef.current.clearConversationState();
      });
      
      wsRef.current.on('error', (errorData) => {
        console.error('[useAutonomous] Error:', errorData);
        setStatus('error');
        setCurrentAction(null);
        // Clear conversation state on error
        wsRef.current.clearConversationState();
      });
      
      // Connect
      await wsRef.current.connect();
      
    } catch (err) {
      console.error('[useAutonomous] Connection failed:', err);
      setStatus('error');
      setError({ code: 'CONNECTION_FAILED', message: err.message });
      throw err;
    }
  }, [status]);

  /**
   * Start autonomous conversation
   */
  const startConversation = useCallback(async (goal, capabilities) => {
    if (!wsRef.current?.connected) {
      throw new Error('Not connected to WebSocket');
    }
    
    console.log('[useAutonomous] Starting conversation:', goal);
    setStatus('running');
    setSteps([]);
    setCurrentAction(null);
    setError(null);
    
    await wsRef.current.startConversation(goal, capabilities);
  }, []);

  /**
   * Send result after action execution
   */
  const sendResult = useCallback(async (stepId, success, result) => {
    if (!wsRef.current?.connected) {
      throw new Error('Not connected to WebSocket');
    }
    
    console.log('[useAutonomous] Sending result:', stepId, success);
    
    // Update step in list
    setSteps(prev => prev.map(step => 
      step.stepId === stepId
        ? {
            ...step,
            status: success ? 'success' : 'failed',
            result,
            completedAt: new Date().toISOString()
          }
        : step
    ));
    
    // Clear current action
    setCurrentAction(null);
    
    await wsRef.current.sendResult(stepId, success, result);
  }, []);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
    setStatus('idle');
    setCurrentAction(null);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    // State
    connected,
    status,
    currentAction,
    steps,
    reconnectInfo,
    error,
    
    // Methods
    connect,
    disconnect,
    startConversation,
    sendResult
  };
}
