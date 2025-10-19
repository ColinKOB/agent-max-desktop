/**
 * FloatBar Input Component
 * Handles the input field with liquid glass styling
 */
import React from 'react';
import { LiquidGlassInput } from '../ui/LiquidGlassCard';

export default function FloatBarInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "What can I help you with?",
  className = ""
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <LiquidGlassInput
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder}
      className={`amx-bar-input ${className}`}
      autoFocus
    />
  );
}
