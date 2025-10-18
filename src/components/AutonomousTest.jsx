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
import { ConsentDialog } from './ConsentDialog';

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
  const [isPaused, setIsPaused] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [consentCache, setConsentCache] = useState({});

  // Define risky action types
  const riskyActions = [
    'file_delete',
    'system_command',
    'database_delete',
    'database_update',
    'network_request_delete',
    'network_request_put',
    'write_file'
  ];

  const isRiskyAction = (actionType) => {
    return riskyActions.some(risky => 
      actionType?.toLowerCase().includes(risky.toLowerCase())
    );
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleStart = async () => {
    try {
      setIsPaused(false);
      await startConversation(goal);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const handlePause = () => {
    // Toggle pause state
    setIsPaused(!isPaused);
    
    if (!isPaused) {
      console.log('[AutonomousTest] Pausing execution...');
      // Note: Currently just UI feedback - backend pause support can be added later
    } else {
      console.log('[AutonomousTest] Resuming execution...');
    }
  };

  const handleStop = () => {
    console.log('[AutonomousTest] Stopping execution...');
    // Disconnect WebSocket to stop execution
    disconnect();
    setIsPaused(false);
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
        backgroundColor: connected ? '#d1fae5' : (status === 'connecting' ? '#dbeafe' : '#fee2e2'),
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {status === 'connecting' && <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>}
          Connection Status: {connected ? '🟢 Connected' : (status === 'connecting' ? '🔵 Connecting...' : '🔴 Disconnected')}
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
            currentStep={steps.filter(s => s.status === 'success').length}
            totalSteps={steps.length}
            status={isPaused ? 'paused' : status}
            onPause={status === 'running' || isPaused ? handlePause : null}
            onStop={status === 'running' ? handleStop : null}
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

      {/* Consent Dialog */}
      {pendingAction && (
        <ConsentDialog
          action={pendingAction.action}
          isRisky={isRiskyAction(pendingAction.action?.type)}
          onApprove={(remember) => {
            if (remember) {
              setConsentCache(prev => ({
                ...prev,
                [pendingAction.action.type]: 'approved'
              }));
            }
            setPendingAction(null);
            console.log('[ConsentDialog] Action approved:', pendingAction.action.type);
          }}
          onDeny={(remember) => {
            if (remember) {
              setConsentCache(prev => ({
                ...prev,
                [pendingAction.action.type]: 'denied'
              }));
            }
            setPendingAction(null);
            console.log('[ConsentDialog] Action denied:', pendingAction.action.type);
            // TODO: Send denial to backend
          }}
        />
      )}

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {steps.map((step, index) => (
              <AutonomousStepCard
                key={step.stepId}
                stepNumber={index + 1}
                actionType={step.action?.type || 'unknown'}
                actionArgs={step.action?.args}
                status={step.status || 'pending'}
                screenshot={step.evidence?.screenshot || step.screenshot}
                error={step.error}
              />
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
