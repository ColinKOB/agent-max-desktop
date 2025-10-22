/**
 * FactTile Component (JSX)
 * Renders deterministic tool results as glass morphism cards
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './FactTile.css';

export function FactTile({ tile }) {
  return (
    <div className="fact-tile" data-tile-id={tile.id}>
      <div className="fact-tile-header">{tile.title}</div>
      <div className="fact-tile-primary">{tile.primary}</div>
      <div className="fact-tile-meta">
        <span className="fact-tile-latency">{Math.round(tile.meta?.latencyMs || 0)} ms</span>
        <span className="fact-tile-confidence">
          conf {Math.round(((tile.meta?.confidence ?? 1) * 100))}%
        </span>
      </div>
      {!!tile.enrichment && (
        <div className="fact-tile-enrichment">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a target="_blank" rel="noreferrer" {...props} />
              ),
            }}
          >
            {tile.enrichment}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
