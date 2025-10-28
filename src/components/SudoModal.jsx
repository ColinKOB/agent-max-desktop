import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Sudo Modal Component
 * 
 * Prompts user for password when elevated commands are requested.
 * Part of Phase 1: Hands on Desktop implementation.
 * 
 * Security:
 * - Password never transmitted to backend
 * - Auto-cleared from memory after use
 * - Timeout after 2 minutes
 */
export default function SudoModal({ command, onApprove, onDeny, visible = false }) {
  const [password, setPassword] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes
  const inputRef = useRef(null);

  // Auto-focus input when modal becomes visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (!visible) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleDeny('Timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible]);

  // Clear password on unmount
  useEffect(() => {
    return () => {
      setPassword('');
    };
  }, []);

  const handleApprove = () => {
    if (!password) return;
    onApprove(password);
    setPassword(''); // Clear immediately
  };

  const handleDeny = (reason = 'User denied') => {
    setPassword(''); // Clear password
    onDeny(reason);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleApprove();
    } else if (e.key === 'Escape') {
      handleDeny();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900/95 to-gray-800/95 p-6 shadow-2xl">
        {/* Close button */}
        <button
          onClick={() => handleDeny()}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2 className="mb-4 text-xl font-semibold text-white">
          Elevated Command Approval Required
        </h2>

        {/* Description */}
        <p className="mb-3 text-sm text-gray-300">
          The following command requires administrator privileges:
        </p>

        {/* Command preview */}
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
          <code className="block break-all font-mono text-sm text-yellow-200">
            $ sudo {command}
          </code>
        </div>

        {/* Password input */}
        <div className="mb-4">
          <label
            htmlFor="sudo-password"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Enter your password to continue:
          </label>
          <input
            ref={inputRef}
            id="sudo-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Password"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-2 text-white placeholder-gray-500 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autoComplete="off"
          />
        </div>

        {/* Timer */}
        <div className="mb-4 text-center">
          <span className="text-sm text-gray-400">
            Time remaining: {Math.floor(timeRemaining / 60)}:
            {String(timeRemaining % 60).padStart(2, '0')}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => handleDeny()}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-medium text-white transition-all hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={!password}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            Approve
          </button>
        </div>

        {/* Security notice */}
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <span className="text-amber-400">⚠️</span>
          <p className="text-xs text-amber-200/80">
            Your password is never sent to the backend. It's used locally to
            execute the command on your machine only.
          </p>
        </div>
      </div>
    </div>
  );
}
