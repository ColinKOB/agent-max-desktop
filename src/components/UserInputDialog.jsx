import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Dialog for AI to request user input during execution
 */
export function UserInputDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [requestId, setRequestId] = useState(null);

  useEffect(() => {
    // Listen for user input requests from Electron main process
    const handleUserInputRequest = (event, data) => {
      console.log('[UserInputDialog] Received request:', data);
      setRequestId(data.requestId);
      setPrompt(data.prompt);
      setDefaultValue(data.defaultValue || '');
      setInputValue(data.defaultValue || '');
      setIsOpen(true);
    };

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('user-input-request', handleUserInputRequest);
      
      return () => {
        window.electron.ipcRenderer.removeListener('user-input-request', handleUserInputRequest);
      };
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (requestId && window.electron?.ipcRenderer) {
      console.log('[UserInputDialog] Sending response:', inputValue);
      window.electron.ipcRenderer.send('user-input-response', {
        requestId,
        response: inputValue
      });
    }
    
    // Close dialog
    setIsOpen(false);
    setRequestId(null);
    setPrompt('');
    setInputValue('');
  };

  const handleCancel = () => {
    if (requestId && window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('user-input-response', {
        requestId,
        response: '' // Empty response on cancel
      });
    }
    
    setIsOpen(false);
    setRequestId(null);
    setPrompt('');
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 24,
        maxWidth: 500,
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: '#fff'
          }}>
            🤖 Agent Max needs your input
          </h3>
          <button
            onClick={handleCancel}
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p style={{
            color: '#cbd5e1',
            fontSize: 14,
            marginBottom: 16,
            lineHeight: 1.5
          }}>
            {prompt}
          </p>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={defaultValue || 'Type your response...'}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              marginBottom: 16,
              outline: 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          />

          <div style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                color: '#999',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
