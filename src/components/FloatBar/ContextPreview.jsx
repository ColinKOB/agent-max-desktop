/**
 * Context Preview Component
 * 
 * Shows the user what context (facts, semantic hits, messages) will be sent
 * to the AI before they send their message. Allows toggling items on/off.
 */

import React, { useState, useEffect } from 'react';
import './ContextPreview.css';
import { stripActionBlocks } from '../../utils/formatters';

const ContextPreview = ({ pack, onToggle, isExpanded, onToggleExpand }) => {
  const [controls, setControls] = useState({
    includeFacts: true,
    includeSemanticHits: true,
    includeRecentMessages: true,
    includePinnedOnly: false,
  });

  // Calculate actual tokens based on controls
  const calculateActiveTokens = () => {
    if (!pack) return 0;
    
    let tokens = 0;
    
    // Count facts tokens
    if (controls.includeFacts) {
      const factsToCount = controls.includePinnedOnly 
        ? pack.facts.filter(f => f.pinned)
        : pack.facts;
      // Rough estimate: category.key: value = ~10 tokens avg
      tokens += factsToCount.length * 10;
    }
    
    // Count semantic hits tokens
    if (controls.includeSemanticHits) {
      // Rough estimate: snippet ~20 tokens
      tokens += pack.semantic_hits.length * 20;
    }
    
    // Count messages tokens
    if (controls.includeRecentMessages) {
      // Rough estimate: role: content ~30 tokens avg
      tokens += pack.recent_messages.length * 30;
    }
    
    return Math.min(tokens, pack.budget.cap);
  };

  const activeTokens = pack ? calculateActiveTokens() : 0;
  const tokenPercentage = pack ? (activeTokens / pack.budget.cap) * 100 : 0;

  // Debounced toggle handler
  const handleToggle = (key) => {
    const newControls = { ...controls, [key]: !controls[key] };
    setControls(newControls);
    
    // Notify parent after short delay
    setTimeout(() => {
      if (onToggle) {
        onToggle(newControls);
      }
    }, 250);
  };

  if (!pack) {
    return (
      <div className="context-preview">
        <div className="context-preview-header">
          <span className="context-preview-title">Loading context...</span>
        </div>
      </div>
    );
  }

  const activeFacts = controls.includePinnedOnly 
    ? pack.facts.filter(f => f.pinned)
    : pack.facts;

  return (
    <div className={`context-preview ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Header */}
      <div className="context-preview-header" onClick={onToggleExpand}>
        <div className="context-preview-title">
          <span className="context-icon">🧠</span>
          <span>Context to be sent</span>
        </div>
        
        <div className="context-preview-meta">
          <div className="token-meter">
            <div className="token-bar">
              <div 
                className="token-fill" 
                style={{ width: `${tokenPercentage}%` }}
              />
            </div>
            <span className="token-count">
              {activeTokens}/{pack.budget.cap} tokens
            </span>
          </div>
          
          <button className="expand-button">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="context-preview-content">
          {/* Control Toggles */}
          <div className="context-controls">
            <label className="context-control">
              <input
                type="checkbox"
                checked={controls.includeFacts}
                onChange={() => handleToggle('includeFacts')}
              />
              <span>Include Facts ({pack.facts.length})</span>
            </label>
            
            <label className="context-control">
              <input
                type="checkbox"
                checked={controls.includeSemanticHits}
                onChange={() => handleToggle('includeSemanticHits')}
              />
              <span>Include Related Context ({pack.semantic_hits.length})</span>
            </label>
            
            <label className="context-control">
              <input
                type="checkbox"
                checked={controls.includeRecentMessages}
                onChange={() => handleToggle('includeRecentMessages')}
              />
              <span>Include Recent Messages ({pack.recent_messages.length})</span>
            </label>
            
            <label className="context-control">
              <input
                type="checkbox"
                checked={controls.includePinnedOnly}
                onChange={() => handleToggle('includePinnedOnly')}
                disabled={!controls.includeFacts}
              />
              <span>Pinned Facts Only</span>
            </label>
          </div>

          {/* Rationale */}
          <div className="context-rationale">
            <strong>Why this context?</strong>
            <p>{pack.rationale}</p>
          </div>

          {/* Facts Section */}
          {controls.includeFacts && activeFacts.length > 0 && (
            <div className="context-section">
              <h4>📌 Facts</h4>
              <div className="context-items">
                {activeFacts.map((fact, idx) => (
                  <div key={idx} className="context-item fact-item">
                    <div className="fact-header">
                      <span className="fact-key">
                        {fact.category}.{fact.key}
                      </span>
                      {fact.pinned && <span className="pinned-badge">📍</span>}
                      <span className="fact-confidence">
                        {Math.round(fact.confidence * 100)}%
                      </span>
                    </div>
                    <div className="fact-value">{fact.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Semantic Hits Section */}
          {controls.includeSemanticHits && pack.semantic_hits.length > 0 && (
            <div className="context-section">
              <h4>💬 Related Context</h4>
              <div className="context-items">
                {pack.semantic_hits.map((hit, idx) => (
                  <div key={idx} className="context-item semantic-item">
                    <div className="semantic-snippet">"{hit.snippet}"</div>
                    <div className="semantic-meta">
                      Score: {Math.round(hit.score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Messages Section */}
          {controls.includeRecentMessages && pack.recent_messages.length > 0 && (
            <div className="context-section">
              <h4>💭 Recent Messages</h4>
              <div className="context-items messages-collapsed">
                <div className="messages-summary">
                  {pack.recent_messages.length} messages (
                  {pack.recent_messages.filter(m => m.role === 'user').length} from you)
                </div>
                <details>
                  <summary>Show all</summary>
                  <div className="messages-list">
                    {pack.recent_messages.map((msg, idx) => (
                      <div key={idx} className={`message-item ${msg.role}`}>
                        <span className="message-role">{msg.role}:</span>
                        <span className="message-content">{stripActionBlocks(msg.content)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextPreview;
