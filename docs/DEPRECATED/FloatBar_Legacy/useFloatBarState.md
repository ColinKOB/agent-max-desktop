# DEPRECATED: src/components/FloatBar/useFloatBarState.js

Do NOT use. Archived on 2025-11-06. Reason: Part of legacy FloatBar stack.

## Original Source

```js
/* BEGIN ORIGINAL FILE: src/components/FloatBar/useFloatBarState.js */
/**
 * FloatBar State Hook
 * Manages window states and transitions
 */
import { useState, useCallback, useEffect } from 'react';

export function useFloatBarState(windowMode = 'single') {
  const isCardWindow = windowMode === 'card';
  const isPillWindow = windowMode === 'pill';
  const isSingleWindow = windowMode === 'single';
  
  // Initial states based on window mode
  const [isOpenState, setIsOpenState] = useState(() => isCardWindow);
  const [isMiniState, setIsMiniState] = useState(() => !isCardWindow);
  const [isBarState, setIsBarState] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Computed states for pill mode
  const isOpen = isPillWindow ? false : isOpenState;
  const isMini = isPillWindow ? true : isMiniState;
  const isBar = isPillWindow ? false : isBarState;

  // State setters that respect window mode
  const setIsOpen = useCallback((value) => {
    if (isPillWindow) return;
    setIsOpenState(value);
  }, [isPillWindow]);

  const setIsMini = useCallback((value) => {
    if (isPillWindow) return;
    setIsMiniState(value);
  }, [isPillWindow]);

  const setIsBar = useCallback((value) => {
    if (isPillWindow) return;
    setIsBarState(value);
  }, [isPillWindow]);

  // Handle expand from mini to bar/card
  const handleExpand = useCallback(() => {
    if (isPillWindow) return;
    
    setIsTransitioning(true);
    setIsMini(false);
    
    if (isSingleWindow) {
      // In single window mode, go to bar state first
      setIsBar(true);
      setIsOpen(false);
    } else {
      // In multi-window mode, go directly to card
      setIsBar(false);
      setIsOpen(true);
    }
    
    // Update window size via Electron IPC if available
    if (window.electron?.window) {
      const targetSize = isOpen ? 'card' : 'bar';
      window.electron.window.resize(targetSize);
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isPillWindow, isSingleWindow, isOpen, setIsMini, setIsBar, setIsOpen]);

  // Handle collapse from card/bar to mini
  const handleCollapse = useCallback(() => {
    if (isPillWindow) return;
    
    setIsTransitioning(true);
    setIsOpen(false);
    setIsBar(false);
    setIsMini(true);
    
    // Update window size via Electron IPC if available
    if (window.electron?.window) {
      window.electron.window.resize('mini');
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isPillWindow, setIsOpen, setIsBar, setIsMini]);

  // Handle minimize (card -> bar)
  const handleMinimize = useCallback(() => {
    if (isPillWindow || !isOpen) return;
    
    setIsTransitioning(true);
    setIsOpen(false);
    setIsBar(true);
    
    // Update window size via Electron IPC if available
    if (window.electron?.window) {
      window.electron.window.resize('bar');
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isPillWindow, isOpen, setIsOpen, setIsBar]);

  // Handle maximize (bar -> card)
  const handleMaximize = useCallback(() => {
    if (isPillWindow || !isBar) return;
    
    setIsTransitioning(true);
    setIsBar(false);
    setIsOpen(true);
    
    // Update window size via Electron IPC if available
    if (window.electron?.window) {
      window.electron.window.resize('card');
    }
    
    setTimeout(() => setIsTransitioning(false), 300);
  }, [isPillWindow, isBar, setIsBar, setIsOpen]);

  // Toggle between states
  const toggleState = useCallback(() => {
    if (isMini) {
      handleExpand();
    } else if (isBar) {
      handleMaximize();
    } else if (isOpen) {
      handleMinimize();
    }
  }, [isMini, isBar, isOpen, handleExpand, handleMaximize, handleMinimize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + M to minimize
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        if (isOpen) handleMinimize();
        else if (isBar) handleCollapse();
      }
      
      // Cmd/Ctrl + Shift + M to maximize
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        if (isBar) handleMaximize();
        else if (isMini) handleExpand();
      }
      
      // Escape to minimize
      if (e.key === 'Escape' && isOpen) {
        handleMinimize();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBar, isMini, handleMinimize, handleMaximize, handleExpand, handleCollapse]);

  return {
    // States
    isOpen,
    isMini,
    isBar,
    isTransitioning,
    windowMode,
    isSingleWindow,
    
    // State setters
    setIsOpen,
    setIsMini,
    setIsBar,
    
    // Actions
    handleExpand,
    handleCollapse,
    handleMinimize,
    handleMaximize,
    toggleState
  };
}
/* END ORIGINAL FILE */
```
