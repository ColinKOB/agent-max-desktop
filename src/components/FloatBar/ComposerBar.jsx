/**
 * ComposerBar Component
 * The input area at the bottom of the chat - handles message input, attachments, and send controls.
 * Extracted from AppleFloatBar for performance (wrapped in React.memo).
 *
 * This extraction prevents the entire message list from re-rendering when the user types.
 */

import React, { useCallback } from 'react';
import { Plus, ArrowUp, Square, Pause, Play, X } from 'lucide-react';

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
}) {
  // Handle file selection from hidden input
  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      files.forEach((file) => {
        const isImage = file.type.startsWith('image/');
        if (isImage) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setAttachments((prev) => [
              ...prev,
              {
                file,
                preview: ev.target.result,
                type: 'image',
              },
            ]);
          };
          reader.readAsDataURL(file);
        } else {
          // For text files, read the content
          const textReader = new FileReader();
          textReader.onload = (ev) => {
            setAttachments((prev) => [
              ...prev,
              {
                file,
                preview: null,
                type: 'file',
                content: ev.target.result, // text content
              },
            ]);
          };
          textReader.readAsText(file);
        }
      });
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
          result.files.forEach((file) => {
            setAttachments((prev) => [
              ...prev,
              {
                file: { name: file.name, size: file.size, path: file.path },
                preview: file.data, // base64 data URL for images
                type: file.type,
                content: file.content, // text content for documents
              },
            ]);
          });
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
    <div className="apple-input-area" ref={composerRef}>
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
      >
        <Plus size={18} />
      </button>

      <textarea
        ref={inputRef}
        className={`apple-input apple-textarea${message.includes('\n') || inputRef.current?.scrollHeight > 40 ? ' has-overflow' : ''}`}
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
