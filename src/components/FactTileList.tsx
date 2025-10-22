/**
 * FactTileList Component
 * Container for fact tiles with enrichment streaming support
 * Part of Phase 2: Deterministic Tools
 */

import React from 'react';
import { FactTile, FactTileData } from './FactTile';

interface FactTileListProps {
  tiles: FactTileData[];
}

export function FactTileList({ tiles }: FactTileListProps) {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className="fact-tile-list">
      {tiles.map((tile) => (
        <FactTile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
