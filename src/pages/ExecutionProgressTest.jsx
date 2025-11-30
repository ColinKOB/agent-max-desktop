/**
 * Test page for ExecutionProgress component
 * Access via: http://localhost:5173/#/execution-test
 */
import React, { useState, useEffect } from 'react';
import ExecutionProgress from '../components/ExecutionProgress/ExecutionProgress';

const MOCK_STEPS = [
  { id: 'step-1', description: 'Analyzing user request', goal: 'Understand what the user wants', tool_name: 'think' },
  { id: 'step-2', description: 'Creating to-do list structure', goal: 'Build the list format', tool_name: 'create_file' },
  { id: 'step-3', description: 'Adding list items', goal: 'Populate with tasks', tool_name: 'write_content' },
  { id: 'step-4', description: 'Formatting output', goal: 'Make it readable', tool_name: 'format' },
  { id: 'step-5', description: 'Delivering response', goal: 'Send to user', tool_name: 'respond' }
];

export default function ExecutionProgressTest() {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatuses, setStepStatuses] = useState({ 0: 'running', 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending' });
  const [currentAction, setCurrentAction] = useState('Analyzing your request...');
  const [startTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [summary, setSummary] = useState(null);

  // Simulate progression through steps
  useEffect(() => {
    if (isComplete) return;
    
    const actions = [
      'Analyzing your request...',
      'Creating file structure...',
      'Writing content to file...',
      'Formatting the output...',
      'Preparing final response...'
    ];

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= MOCK_STEPS.length - 1) {
          clearInterval(interval);
          setIsComplete(true);
          setSummary({
            status: 'complete',
            message: '✅ Successfully completed all 5 steps',
            successCount: 5,
            failedCount: 0,
            goalAchieved: true
          });
          return prev;
        }
        
        // Update statuses
        setStepStatuses(prevStatuses => {
          const updated = { ...prevStatuses };
          updated[prev] = 'done';
          updated[prev + 1] = 'running';
          return updated;
        });
        
        // Update current action
        setCurrentAction(actions[prev + 1] || 'Working...');
        
        return prev + 1;
      });
    }, 3000); // 3 seconds per step

    return () => clearInterval(interval);
  }, [isComplete]);

  const resetDemo = () => {
    setCurrentStep(0);
    setStepStatuses({ 0: 'running', 1: 'pending', 2: 'pending', 3: 'pending', 4: 'pending' });
    setCurrentAction('Analyzing your request...');
    setIsComplete(false);
    setSummary(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1f, #0d0d10)',
      padding: '40px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ color: '#fff', marginBottom: '8px', fontSize: '24px' }}>
          Execution Progress Test
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '24px', fontSize: '14px' }}>
          This simulates the AI working through a multi-step task. Each step takes 3 seconds.
        </p>
        
        {/* User message simulation */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#fff',
          fontSize: '14px'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'block', marginBottom: '4px' }}>
            You
          </span>
          Create a to-do list for testing the UI
        </div>
        
        {/* Execution Progress Component */}
        <ExecutionProgress
          steps={MOCK_STEPS}
          stepStatuses={stepStatuses}
          currentStep={currentStep}
          summary={summary}
          currentAction={currentAction}
          startTime={startTime}
        />
        
        {/* Controls */}
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            onClick={resetDemo}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #ac7433, #8a5a28)',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            🔄 Restart Demo
          </button>
          
          <button
            onClick={() => {
              setSummary({
                status: 'failed',
                message: '❌ Execution failed after 2 steps',
                successCount: 2,
                failedCount: 1,
                goalAchieved: false
              });
              setIsComplete(true);
              setStepStatuses(prev => ({ ...prev, [currentStep]: 'failed' }));
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⚠️ Simulate Failure
          </button>
        </div>
        
        {/* Debug info */}
        <div style={{
          marginTop: '32px',
          padding: '16px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.6)'
        }}>
          <div><strong>Debug Info:</strong></div>
          <div>Current Step: {currentStep}</div>
          <div>Status: {isComplete ? 'Complete' : 'Running'}</div>
          <div>Current Action: {currentAction}</div>
          <div>Step Statuses: {JSON.stringify(stepStatuses)}</div>
        </div>
      </div>
    </div>
  );
}
