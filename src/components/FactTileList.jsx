/**
 * FactTileList Component (JSX)
 * Container for glass morphism fact tiles with enrichment streaming support
 */

import React from 'react';
import { FactTile } from './FactTile.jsx';

export function FactTileList({ tiles }) {
  if (!tiles || tiles.length === 0) return null;
  return (
    <div className="fact-tile-list">
      {tiles.map((tile) => (
        <FactTile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
