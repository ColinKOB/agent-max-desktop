/**
 * TypewriterMessage Component
 * Renders markdown content with a typewriter effect
 * Makes AI responses feel more natural and streamed
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './TypewriterMessage.css';

/**
 * TypewriterMessage - renders text with a progressive reveal effect
 * @param {string} content - The markdown content to display
 * @param {number} speed - Characters per second (default: 100)
 * @param {boolean} enabled - Whether to animate (default: true for new messages)
 * @param {function} onComplete - Called when animation finishes
 */
export default function TypewriterMessage({ 
  content, 
  speed = 100, 
  enabled = true,
  onComplete,
  className = '',
}) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const contentRef = useRef(content);
  const intervalRef = useRef(null);
  const hasStartedRef = useRef(false);

  // Skip to end on click
  const handleSkip = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setDisplayedContent(contentRef.current || '');
    setIsTyping(false);
    indexRef.current = (contentRef.current || '').length;
    onComplete?.();
  };

  useEffect(() => {
    contentRef.current = content;

    // If disabled or no content, show immediately
    if (!enabled || !content) {
      setDisplayedContent(content || '');
      setIsTyping(false);
      hasStartedRef.current = true;
      return;
    }

    // If already started with same content, don't restart
    if (hasStartedRef.current && displayedContent === content) {
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start fresh animation
    setDisplayedContent('');
    indexRef.current = 0;
    setIsTyping(true);
    hasStartedRef.current = true;

    const msPerChar = 1000 / speed;
    
    // Batch characters for smoother animation
    const charsPerTick = speed > 150 ? 4 : speed > 80 ? 3 : speed > 40 ? 2 : 1;

    intervalRef.current = setInterval(() => {
      const fullContent = contentRef.current || '';
      const currentIndex = indexRef.current;

      if (currentIndex >= fullContent.length) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsTyping(false);
        onComplete?.();
        return;
      }

      // Smart chunking: try to break at word boundaries for cleaner rendering
      let endIndex = Math.min(currentIndex + charsPerTick, fullContent.length);
      
      // If we're mid-word and not at end, extend to word boundary (up to 10 chars)
      if (endIndex < fullContent.length) {
        const nextSpace = fullContent.indexOf(' ', endIndex);
        const nextNewline = fullContent.indexOf('\n', endIndex);
        const nextBreak = Math.min(
          nextSpace > 0 ? nextSpace : Infinity,
          nextNewline > 0 ? nextNewline : Infinity
        );
        if (nextBreak < endIndex + 10 && nextBreak < fullContent.length) {
          endIndex = nextBreak + 1;
        }
      }

      setDisplayedContent(fullContent.slice(0, endIndex));
      indexRef.current = endIndex;
    }, msPerChar * charsPerTick);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [content, speed, enabled, onComplete]);

  // Memoize markdown components for performance
  const components = useMemo(() => ({
    // Make code blocks look nice
    code: ({ node, inline, className: codeClassName, children, ...props }) => {
      return inline ? (
        <code className={`inline-code ${codeClassName || ''}`} {...props}>
          {children}
        </code>
      ) : (
        <pre className="code-block">
          <code className={codeClassName} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    // Make links open externally
    a: ({ node, children, href, ...props }) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer" 
        {...props}
      >
        {children}
      </a>
    ),
  }), []);

  return (
    <div 
      className={`typewriter-message ${className} ${isTyping ? 'is-typing' : ''}`}
      onClick={isTyping ? handleSkip : undefined}
      title={isTyping ? 'Click to skip animation' : undefined}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {displayedContent}
      </ReactMarkdown>
      {isTyping && (
        <span className="typewriter-cursor" aria-hidden="true">▋</span>
      )}
    </div>
  );
}
