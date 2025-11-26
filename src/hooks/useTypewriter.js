/**
 * useTypewriter Hook
 * Creates a typewriter/streaming effect for text content
 * Makes responses appear to stream even when they arrive all at once
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Hook to create a typewriter effect for text
 * @param {string} text - The full text to display
 * @param {object} options - Configuration options
 * @param {number} options.speed - Characters per second (default: 80)
 * @param {boolean} options.enabled - Whether to enable the effect (default: true)
 * @param {function} options.onComplete - Callback when animation completes
 * @returns {object} { displayText, isTyping, skip }
 */
export function useTypewriter(text, options = {}) {
  const {
    speed = 80, // chars per second - feels natural for reading
    enabled = true,
    onComplete = null,
  } = options;

  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const intervalRef = useRef(null);
  const indexRef = useRef(0);
  const textRef = useRef(text);

  // Skip to end
  const skip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayText(textRef.current || '');
    setIsTyping(false);
    indexRef.current = (textRef.current || '').length;
    onComplete?.();
  };

  useEffect(() => {
    // Update text ref
    textRef.current = text;

    // If disabled or no text, show immediately
    if (!enabled || !text) {
      setDisplayText(text || '');
      setIsTyping(false);
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // If text changed, start fresh
    setDisplayText('');
    indexRef.current = 0;
    setIsTyping(true);

    // Calculate interval (ms per character)
    const msPerChar = 1000 / speed;

    intervalRef.current = setInterval(() => {
      const currentText = textRef.current || '';
      const currentIndex = indexRef.current;

      if (currentIndex >= currentText.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsTyping(false);
        onComplete?.();
        return;
      }

      // Add next character(s) - batch for speed
      // Add 2-4 chars at a time for faster typing at high speeds
      const charsToAdd = speed > 100 ? 3 : speed > 50 ? 2 : 1;
      const endIndex = Math.min(currentIndex + charsToAdd, currentText.length);
      
      setDisplayText(currentText.slice(0, endIndex));
      indexRef.current = endIndex;
    }, msPerChar);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [text, speed, enabled, onComplete]);

  return {
    displayText,
    isTyping,
    skip,
    isComplete: displayText === text,
  };
}

/**
 * Typewriter component wrapper for easy use
 */
export function TypewriterText({ 
  text, 
  speed = 80, 
  enabled = true, 
  onComplete,
  className = '',
  children, // render prop for custom rendering
}) {
  const { displayText, isTyping, skip, isComplete } = useTypewriter(text, {
    speed,
    enabled,
    onComplete,
  });

  if (children) {
    return children({ displayText, isTyping, skip, isComplete });
  }

  return (
    <span className={className} onClick={skip} style={{ cursor: isTyping ? 'pointer' : 'default' }}>
      {displayText}
      {isTyping && <span className="typewriter-cursor">▋</span>}
    </span>
  );
}

export default useTypewriter;
