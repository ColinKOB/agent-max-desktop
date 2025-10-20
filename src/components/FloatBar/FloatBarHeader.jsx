import React from 'react';
import { Minimize2, Settings, Trash2, Menu } from 'lucide-react';

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
          <button
            type="button"
            className="amx-icon-btn"
            onClick={onMenu}
            aria-label="Menu"
          >
            <Menu size={14} />
          </button>
        )}
        {onClear && (
          <button
            type="button"
            className="amx-icon-btn"
            onClick={onClear}
            aria-label="Clear conversation"
          >
            <Trash2 size={14} />
          </button>
        )}
        {onSettings && (
          <button
            type="button"
            className="amx-icon-btn"
            onClick={onSettings}
            aria-label="Settings"
          >
            <Settings size={14} />
          </button>
        )}
        {onMinimize && (
          <button
            type="button"
            className="amx-icon-btn"
            onClick={onMinimize}
            aria-label="Minimize"
          >
            <Minimize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
