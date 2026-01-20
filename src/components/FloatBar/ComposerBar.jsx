/**
 * ComposerBar Component
 * The input area at the bottom of the chat - handles message input, attachments, and send controls.
 * Extracted from AppleFloatBar for performance (wrapped in React.memo).
 *
 * This extraction prevents the entire message list from re-rendering when the user types.
 */

import React, { useCallback } from 'react';
import { Plus, ArrowUp, Square, Pause, Play, X, Search, Zap, ShoppingCart } from 'lucide-react';
import { processImageFile, compressImage } from '../../utils/imageCompression';

const ComposerBar = React.memo(function ComposerBar({
  // Refs
  composerRef,
  fileInputRef,
  inputRef,
  hoverTimeoutRef,
  planIdRef,
  // State values
  message,
  attachments,
  userInputRequest,
  apiConnected,
  isThinking,
  executionPlan,
  executionSummary,
  runStatus,
  showSendControls,
  // Setters
  setMessage,
  setAttachments,
  setShowSendControls,
  // Handlers
  handleUserInputSubmit,
  handleSubmit,
  handleStopAll,
  handleResumeRun,
  handlePauseRun,
  handleCancelRun,
  // AI-triggered options
  aiOptions,      // {options: [{id, label}], prompt: string, runId: string}
  setAiOptions,   // Setter to clear options after selection
}) {
  // Handle file selection from hidden input - with compression for images
  const handleFileChange = useCallback(
    async (e) => {
      const files = Array.from(e.target.files || []);

      // Process all files with compression
      const processPromises = files.map((file) =>
        processImageFile(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8,
        })
      );

      try {
        const results = await Promise.all(processPromises);
        setAttachments((prev) => [...prev, ...results]);
      } catch (err) {
        console.error('[ComposerBar] Error processing files:', err);
      }

      e.target.value = ''; // Reset input
    },
    [setAttachments]
  );

  // Handle attach button click
  const handleAttachClick = useCallback(async () => {
    // Use native file dialog if available (opens as separate window)
    const openFileDialog = window.electron?.openFileDialog || window.electronAPI?.openFileDialog;
    if (openFileDialog) {
      try {
        const result = await openFileDialog();
        if (result?.success && result.files?.length) {
          // Process files with compression for images
          const processPromises = result.files.map(async (file) => {
            if (file.type === 'image' && file.data) {
              // Compress the image data
              try {
                const compressed = await compressImage(file.data, {
                  maxWidth: 1920,
                  maxHeight: 1080,
                  quality: 0.8,
                });
                return {
                  file: { name: file.name, size: file.size, path: file.path },
                  preview: compressed.dataUrl,
                  type: file.type,
                  compressionInfo: {
                    originalSize: compressed.originalSize,
                    compressedSize: compressed.compressedSize,
                    reduction: compressed.reduction,
                  },
                };
              } catch (err) {
                console.warn('[FileDialog] Compression failed, using original:', err);
                return {
                  file: { name: file.name, size: file.size, path: file.path },
                  preview: file.data,
                  type: file.type,
                };
              }
            }
            // Non-image files pass through unchanged
            return {
              file: { name: file.name, size: file.size, path: file.path },
              preview: file.data,
              type: file.type,
              content: file.content,
            };
          });

          const processedFiles = await Promise.all(processPromises);
          setAttachments((prev) => [...prev, ...processedFiles]);
        }
      } catch (err) {
        console.error('[FileDialog] Error:', err);
        // Fallback to HTML input
        fileInputRef.current?.click();
      }
    } else {
      // Fallback for web
      fileInputRef.current?.click();
    }
  }, [fileInputRef, setAttachments]);

  // Handle textarea change with auto-resize
  const handleMessageChange = useCallback(
    (e) => {
      setMessage(e.target.value);
      // Auto-resize textarea - only grow when content actually wraps.
      e.target.style.height = 'auto';
      const scrollHeight = e.target.scrollHeight;
      const singleLineMax = 36; // Accounts for padding
      const isMultiLine = scrollHeight > singleLineMax;

      if (isMultiLine) {
        const newHeight = Math.min(scrollHeight, 120);
        e.target.style.height = newHeight + 'px';
        e.target.classList.add('has-overflow');
      } else {
        e.target.style.height = '';
        e.target.classList.remove('has-overflow');
      }
    },
    [setMessage]
  );

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (userInputRequest) {
          handleUserInputSubmit();
        } else {
          handleSubmit();
        }
      }
    },
    [userInputRequest, handleUserInputSubmit, handleSubmit]
  );

  // Handle mouse enter on send wrapper
  const handleSendWrapperMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    const hasActiveRun =
      (executionPlan && !executionSummary) ||
      ((runStatus === 'running' || runStatus === 'paused') && (executionPlan || planIdRef.current));
    if (hasActiveRun) {
      setShowSendControls(true);
    }
  }, [executionPlan, executionSummary, runStatus, planIdRef, hoverTimeoutRef, setShowSendControls]);

  // Handle mouse leave on send wrapper
  const handleSendWrapperMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSendControls(false);
      hoverTimeoutRef.current = null;
    }, 500);
  }, [hoverTimeoutRef, setShowSendControls]);

  // Determine button states
  const isExecuting = isThinking || (executionPlan && !executionSummary) || runStatus === 'running';
  const showControls =
    showSendControls &&
    ((executionPlan && !executionSummary) ||
      ((runStatus === 'running' || runStatus === 'paused') && (executionPlan || planIdRef.current)));
  const sendDisabled =
    (!message.trim() && attachments.length === 0) || (!userInputRequest && !apiConnected);

  return (
    <div className="apple-input-area" ref={composerRef} data-tutorial="input-area">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.json,.csv"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Attach button */}
      <button
        className="apple-attach-btn"
        onClick={handleAttachClick}
        title="Attach files or images"
        data-tutorial="attach"
      >
        <Plus size={18} />
      </button>

      {/* AI-triggered Option Buttons - Shows when AI calls show_options tool */}
      {aiOptions && aiOptions.options && aiOptions.options.length > 0 && (
        <div className="ai-options-container">
          {aiOptions.prompt && (
            <span className="ai-options-prompt">{aiOptions.prompt}</span>
          )}
          <div className="ai-options-buttons">
            {aiOptions.options.map((option, index) => (
              <button
                key={option.id || index}
                className={`ai-option-btn ai-option-btn-${index}`}
                onClick={() => {
                  // Send the selection back to the AI
                  if (setAiOptions) {
                    // Clear the options
                    setAiOptions(null);
                  }
                  // Set the message with both ID and label for backend parsing
                  const selectionText = option.id
                    ? `I choose: ${option.label} (${option.id})`
                    : `I choose: ${option.label}`;
                  setMessage(selectionText);
                  // Auto-submit after a brief delay
                  setTimeout(() => {
                    const submitBtn = document.querySelector('.apple-send-btn');
                    if (submitBtn && !submitBtn.disabled) {
                      submitBtn.click();
                    }
                  }, 50);
                }}
                title={option.description || option.label}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        className={`apple-input apple-textarea${message.includes('\n') || inputRef.current?.scrollHeight > 40 ? ' has-overflow' : ''}`}
        data-tutorial="input"
        placeholder={
          userInputRequest
            ? 'Type your response...'
            : apiConnected
              ? 'Ask anything...'
              : 'Connecting...'
        }
        value={message}
        onChange={handleMessageChange}
        onKeyDown={handleKeyDown}
        disabled={!apiConnected || (isThinking && !userInputRequest)}
        rows={1}
        style={
          userInputRequest
            ? {
                borderColor: 'rgba(59, 130, 246, 0.5)',
                background: 'rgba(59, 130, 246, 0.05)',
              }
            : {}
        }
      />

      <div
        className="apple-send-wrapper"
        onMouseEnter={handleSendWrapperMouseEnter}
        onMouseLeave={handleSendWrapperMouseLeave}
      >
        {showControls && (
          <div className="send-controls-popup">
            {runStatus === 'paused' ? (
              <>
                <button
                  className="control-btn resume-btn"
                  onClick={handleResumeRun}
                  title="Resume execution"
                >
                  <Play size={14} />
                  <span>Resume</span>
                </button>
                <button
                  className="control-btn cancel-btn"
                  onClick={handleCancelRun}
                  title="Cancel execution"
                >
                  <X size={14} />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className="control-btn pause-btn"
                  onClick={handlePauseRun}
                  title="Pause execution"
                >
                  <Pause size={14} />
                  <span>Pause</span>
                </button>
                <button
                  className="control-btn cancel-btn"
                  onClick={handleCancelRun}
                  title="Cancel execution"
                >
                  <X size={14} />
                  <span>Cancel</span>
                </button>
              </>
            )}
          </div>
        )}

        {/* Show stop button when AI is working, otherwise show send button */}
        {isExecuting ? (
          <button className="apple-send-btn apple-stop-btn" onClick={handleStopAll} title="Stop AI">
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            className="apple-send-btn"
            onClick={userInputRequest ? handleUserInputSubmit : handleSubmit}
            disabled={sendDisabled}
            data-tutorial="send"
            style={
              userInputRequest
                ? {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  }
                : {}
            }
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
    </div>
  );
});

export default ComposerBar;
