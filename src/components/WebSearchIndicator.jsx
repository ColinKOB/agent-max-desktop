/**
 * WebSearchIndicator - Animated indicator showing AI is searching the web
 *
 * Displays a cool animation with:
 * - Pulsing globe icon when searching
 * - Website URLs/titles as they're found
 * - Smooth transitions between states
 */
import React, { useState, useEffect, useRef } from 'react';
import './WebSearchIndicator.css';

const WebSearchIndicator = ({
  isSearching = false,
  citations = [],
  onComplete
}) => {
  const [visibleCitations, setVisibleCitations] = useState([]);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const containerRef = useRef(null);

  // Animate citations appearing one by one
  useEffect(() => {
    if (citations.length > visibleCitations.length) {
      const timer = setTimeout(() => {
        setVisibleCitations(citations.slice(0, visibleCitations.length + 1));
      }, 300); // Stagger each citation by 300ms
      return () => clearTimeout(timer);
    }
  }, [citations, visibleCitations.length]);

  // Reset when search completes
  useEffect(() => {
    if (!isSearching && visibleCitations.length > 0) {
      // Keep showing for a moment after search completes
      const timer = setTimeout(() => {
        setIsAnimatingOut(true);
        setTimeout(() => {
          setVisibleCitations([]);
          setIsAnimatingOut(false);
          onComplete?.();
        }, 500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSearching, visibleCitations.length, onComplete]);

  if (!isSearching && visibleCitations.length === 0) {
    return null;
  }

  // Extract domain from URL for cleaner display
  const getDomain = (url) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Get favicon URL
  const getFavicon = (url) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch {
      return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`web-search-indicator ${isAnimatingOut ? 'animating-out' : ''}`}
    >
      <div className="search-header">
        <div className={`globe-icon ${isSearching ? 'pulsing' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </div>
        <span className="search-text">
          {isSearching ? 'Searching the web...' : 'Found sources'}
        </span>
        {isSearching && (
          <div className="search-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}
      </div>

      {visibleCitations.length > 0 && (
        <div className="citations-list">
          {visibleCitations.map((citation, index) => (
            <div
              key={citation.url || index}
              className="citation-item"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {getFavicon(citation.url) && (
                <img
                  src={getFavicon(citation.url)}
                  alt=""
                  className="citation-favicon"
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <div className="citation-content">
                <span className="citation-title">
                  {citation.title || getDomain(citation.url)}
                </span>
                <span className="citation-domain">
                  {getDomain(citation.url)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSearchIndicator;
