import React, { useState, useEffect } from 'react';
import { X, MessageCircle, CheckCircle } from 'lucide-react';

/**
 * Dialog for AI to request user input during execution
 * Supports both simple text input and multiple-choice options
 */
export function UserInputDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogType, setDialogType] = useState('input'); // 'input' or 'question'
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [allowCustomResponse, setAllowCustomResponse] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [requestId, setRequestId] = useState(null);

  useEffect(() => {
    // Listen for legacy user input requests from Electron main process
    const handleUserInputRequest = (event, data) => {
      console.log('[UserInputDialog] Received input request:', data);
      setDialogType('input');
      setRequestId(data.requestId);
      setPrompt(data.prompt);
      setDefaultValue(data.defaultValue || '');
      setInputValue(data.defaultValue || '');
      setOptions([]);
      setContext('');
      setIsOpen(true);
    };

    // Listen for new ask_user questions from AI
    const handleAskUserQuestion = (data) => {
      console.log('[UserInputDialog] Received ask_user question:', data);
      setDialogType('question');
      setRequestId(data.timestamp); // Use timestamp as ID
      setPrompt(data.question);
      setContext(data.context || '');
      setOptions(data.options || []);
      setAllowCustomResponse(data.allowCustomResponse || false);
      setSelectedOption(null);
      setShowCustomInput(false);
      setInputValue('');
      setIsOpen(true);
    };

    // Set up listeners
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('user-input-request', handleUserInputRequest);
    }

    // New ask_user listener
    if (window.askUser?.onQuestion) {
      window.askUser.onQuestion(handleAskUserQuestion);
    }

    return () => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener('user-input-request', handleUserInputRequest);
      }
      if (window.askUser?.removeListener) {
        window.askUser.removeListener();
      }
    };
  }, []);

  const handleSubmit = (e) => {
    e?.preventDefault();

    if (dialogType === 'input') {
      // Legacy input handler
      if (requestId && window.electron?.ipcRenderer) {
        console.log('[UserInputDialog] Sending input response:', inputValue);
        window.electron.ipcRenderer.send('user-input-response', {
          requestId,
          response: inputValue
        });
      }
    } else {
      // New ask_user handler
      const response = {
        cancelled: false,
        answer: showCustomInput ? inputValue : null,
        selectedOption: selectedOption?.label || null,
        selectedOptionId: selectedOption?.id || null
      };

      console.log('[UserInputDialog] Sending ask_user response:', response);

      if (window.askUser?.respond) {
        window.askUser.respond(response);
      }
    }

    closeDialog();
  };

  const handleCancel = () => {
    if (dialogType === 'input') {
      if (requestId && window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send('user-input-response', {
          requestId,
          response: ''
        });
      }
    } else {
      if (window.askUser?.respond) {
        window.askUser.respond({ cancelled: true });
      }
    }

    closeDialog();
  };

  const closeDialog = () => {
    setIsOpen(false);
    setRequestId(null);
    setPrompt('');
    setContext('');
    setInputValue('');
    setOptions([]);
    setSelectedOption(null);
    setShowCustomInput(false);
  };

  const handleOptionSelect = (option) => {
    setSelectedOption(option);
    setShowCustomInput(false);
  };

  const handleCustomInputClick = () => {
    setSelectedOption(null);
    setShowCustomInput(true);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'rgba(25, 25, 30, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        padding: 28,
        maxWidth: 520,
        width: '90%',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageCircle size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                color: '#fff'
              }}>
                Agent Max has a question
              </h3>
              {context && (
                <p style={{
                  margin: '4px 0 0',
                  fontSize: 12,
                  color: '#888'
                }}>
                  {context}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleCancel}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Question */}
        <p style={{
          color: '#e2e8f0',
          fontSize: 15,
          marginBottom: 20,
          lineHeight: 1.6
        }}>
          {prompt}
        </p>

        {/* Options (for ask_user type) */}
        {dialogType === 'question' && options.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {options.map((option, index) => (
              <button
                key={option.id || index}
                onClick={() => handleOptionSelect(option)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  marginBottom: 8,
                  background: selectedOption?.id === option.id
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedOption?.id === option.id
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: selectedOption?.id === option.id
                    ? '2px solid #3b82f6'
                    : '2px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedOption?.id === option.id && (
                    <CheckCircle size={14} color="#3b82f6" />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{option.label}</div>
                  {option.description && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {option.description}
                    </div>
                  )}
                </div>
              </button>
            ))}

            {/* Custom response option */}
            {allowCustomResponse && (
              <button
                onClick={handleCustomInputClick}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: showCustomInput
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: showCustomInput
                    ? '1px solid rgba(59, 130, 246, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  color: '#888',
                  fontSize: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Type a custom response...
              </button>
            )}
          </div>
        )}

        {/* Custom input field */}
        {(dialogType === 'input' || showCustomInput) && (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={defaultValue || 'Type your response...'}
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
                color: '#fff',
                fontSize: 14,
                marginBottom: 16,
                outline: 'none',
                transition: 'border-color 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />
          </form>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          marginTop: dialogType === 'question' && !showCustomInput ? 8 : 0
        }}>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              color: '#888',
              fontSize: 14,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={dialogType === 'question' && !selectedOption && !showCustomInput}
            style={{
              padding: '10px 24px',
              background: (dialogType === 'question' && !selectedOption && !showCustomInput)
                ? 'rgba(59, 130, 246, 0.3)'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: (dialogType === 'question' && !selectedOption && !showCustomInput)
                ? 'not-allowed'
                : 'pointer',
              transition: 'all 0.15s ease',
              opacity: (dialogType === 'question' && !selectedOption && !showCustomInput) ? 0.5 : 1
            }}
          >
            {dialogType === 'question' ? 'Continue' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
