/**
 * FactTile Component
 * Renders deterministic tool results (time, date, math, unit conversions) as instant fact tiles
 * Part of Phase 2: Deterministic Tools
 */

import React from 'react';
import './FactTile.css';

export interface FactTileMeta {
  latencyMs: number;
  confidence: number;
  timestamp?: string;
}

export interface FactTileData {
  id: string;
  title: string;
  primary: string;
  meta: FactTileMeta;
  raw?: any;
  enrichment?: string;
}

interface FactTileProps {
  tile: FactTileData;
}

export function FactTile({ tile }: FactTileProps) {
  return (
    <div className="fact-tile" data-tile-id={tile.id}>
      <div className="fact-tile-header">{tile.title}</div>
      <div className="fact-tile-primary">{tile.primary}</div>
      <div className="fact-tile-meta">
        <span className="fact-tile-latency">{Math.round(tile.meta.latencyMs)} ms</span>
        <span className="fact-tile-confidence">
          conf {Math.round((tile.meta.confidence ?? 1) * 100)}%
        </span>
      </div>
      {tile.enrichment && (
        <div className="fact-tile-enrichment">{tile.enrichment}</div>
      )}
    </div>
  );
}
