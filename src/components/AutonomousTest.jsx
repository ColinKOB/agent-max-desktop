/**
 * Autonomous Test Component
 * 
 * Simple UI to test the autonomous execution WebSocket flow
 */

import { useState } from 'react';
import { useAutonomous } from '../hooks/useAutonomous';
import { UsageIndicator } from './UsageIndicator';
import { AutonomousProgress } from './AutonomousProgress';
import { AutonomousStepCard } from './AutonomousStepCard';

export function AutonomousTest() {
  const { 
    connected, 
    status, 
    currentAction, 
    steps, 
    reconnectInfo,
    error,
    connect, 
    disconnect,
    startConversation
  } = useAutonomous();

  const [goal, setGoal] = useState('Test autonomous execution with 3 steps');

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleStart = async () => {
    try {
      await startConversation(goal);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle': return '#6b7280';
      case 'connecting': return '#3b82f6';
      case 'running': return '#f59e0b';
      case 'complete': return '#10b981';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusEmoji = () => {
    switch (status) {
      case 'idle': return '⚪';
      case 'connecting': return '🔵';
      case 'running': return '🟡';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  return (
    <div style={{
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        🧪 Autonomous Execution Test
      </h1>

      {/* Connection Status */}
      <div style={{
        padding: '16px',
        backgroundColor: connected ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
          Connection Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          Execution Status: {getStatusEmoji()} {status}
        </div>
      </div>

      {/* Usage Indicator */}
      <div style={{ marginBottom: '20px' }}>
        <UsageIndicator />
      </div>

      {/* Progress Indicator */}
      {status !== 'idle' && steps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <AutonomousProgress
            currentStep={steps.filter(s => s.status === 'complete').length}
            totalSteps={steps.length}
            status={status}
          />
        </div>
      )}

      {/* Reconnection Indicator */}
      {status === 'reconnecting' && reconnectInfo && (
        <div style={{ 
          padding: '12px', 
          backgroundColor: '#fff3cd', 
          border: '1px solid #ffc107',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>
            🔄 Reconnecting...
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
            Attempt {reconnectInfo.attempt} - Retrying in {Math.round(reconnectInfo.delay / 1000)}s
          </p>
        </div>
      )}

      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        {!connected ? (
          <button
            onClick={handleConnect}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Connect to Backend
          </button>
        ) : (
          <>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Enter goal..."
              disabled={status === 'running'}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                marginBottom: '12px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleStart}
                disabled={status === 'running' || !goal}
                style={{
                  padding: '12px 24px',
                  backgroundColor: status === 'running' ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: status === 'running' ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                  flex: 1
                }}
              >
                {status === 'running' ? 'Running...' : 'Start Conversation'}
              </button>
              <button
                onClick={disconnect}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      {/* Current Action */}
      {currentAction && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid #f59e0b'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#92400e' }}>
            ⚡ Executing Now:
          </div>
          <div style={{ fontSize: '14px', color: '#78350f' }}>
            <strong>Action:</strong> {currentAction.action.type}
          </div>
          <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
            Step {currentAction.seq} of 3
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: '#fee2e2',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '2px solid #ef4444'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#991b1b' }}>
            ❌ Error:
          </div>
          <div style={{ fontSize: '14px', color: '#7f1d1d' }}>
            {error.message || error.code}
          </div>
        </div>
      )}

      {/* Steps List */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>
          Steps ({steps.length})
        </h2>
        {steps.length === 0 ? (
          <div style={{ 
            padding: '24px', 
            textAlign: 'center', 
            color: '#9ca3af',
            border: '2px dashed #d1d5db',
            borderRadius: '8px'
          }}>
            No steps yet. Connect and start a conversation.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {steps.map((step) => (
              <div
                key={step.stepId}
                style={{
                  padding: '16px',
                  backgroundColor: 
                    step.status === 'success' ? '#d1fae5' :
                    step.status === 'failed' ? '#fee2e2' :
                    '#f3f4f6',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {step.status === 'success' ? '✅' :
                     step.status === 'failed' ? '❌' :
                     '⏳'} Step {step.seq}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    padding: '4px 8px',
                    backgroundColor: 
                      step.status === 'success' ? '#10b981' :
                      step.status === 'failed' ? '#ef4444' :
                      '#f59e0b',
                    color: 'white',
                    borderRadius: '4px',
                    fontWeight: '500'
                  }}>
                    {step.status}
                  </div>
                </div>
                
                <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                  <strong>Action:</strong> {step.action.type}
                </div>
                
                {step.action.args && Object.keys(step.action.args).length > 0 && (
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#6b7280',
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    {JSON.stringify(step.action.args, null, 2)}
                  </div>
                )}
                {step.completedAt && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af',
                    marginTop: '8px'
                  }}>
                    Completed: {new Date(step.completedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Success Message */}
      {status === 'complete' && (
        <div style={{
          padding: '20px',
          backgroundColor: '#d1fae5',
          borderRadius: '8px',
          textAlign: 'center',
          border: '2px solid #10b981'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46' }}>
            Conversation Complete!
          </div>
          <div style={{ fontSize: '14px', color: '#047857', marginTop: '8px' }}>
            All {steps.length} steps executed successfully
          </div>
        </div>
      )}
    </div>
  );
}
