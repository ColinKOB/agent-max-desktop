/**
 * FloatBar Header Component
 * Header with greeting and controls
 */
import React from 'react';
import { Minimize2, Settings, Trash2, Menu } from 'lucide-react';
import { LiquidGlassButton } from '../ui/LiquidGlassCard';

export default function FloatBarHeader({
  greeting = "Hi there!",
  onMinimize,
  onSettings,
  onClear,
  onMenu
}) {
  return (
    <div className="amx-header">
      <span className="amx-drag-handle flex-1">{greeting}</span>
      <div className="flex gap-2">
        {onMenu && (
          <LiquidGlassButton
            variant="ghost"
            size="sm"
            onClick={onMenu}
            icon={Menu}
            aria-label="Menu"
          />
        )}
        {onClear && (
          <LiquidGlassButton
            variant="ghost"
            size="sm"
            onClick={onClear}
            icon={Trash2}
            aria-label="Clear conversation"
          />
        )}
        {onSettings && (
          <LiquidGlassButton
            variant="ghost"
            size="sm"
            onClick={onSettings}
            icon={Settings}
            aria-label="Settings"
          />
        )}
        {onMinimize && (
          <LiquidGlassButton
            variant="ghost"
            size="sm"
            onClick={onMinimize}
            icon={Minimize2}
            aria-label="Minimize"
          />
        )}
      </div>
    </div>
  );
}
