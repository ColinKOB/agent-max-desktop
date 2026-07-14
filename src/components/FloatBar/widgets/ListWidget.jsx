/**
 * ListWidget - Renders ordered/ranked lists
 * Design: Numbered items with orange accent, compact card
 */
import React from 'react';
import { List } from 'lucide-react';

const ListWidget = React.memo(function ListWidget({ data }) {
  if (!data || !data.items || data.items.length === 0) return null;

  return (
    <div className="display-card rich-widget-list">
      {data.title && (
        <div className="display-card-label list-widget-title">
          <List size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>{data.title}</span>
        </div>
      )}
      <div className="list-widget-items">
        {data.items.map((item, i) => (
          <div key={i} className="list-widget-item">
            <span className="list-widget-number">{i + 1}</span>
            <div className="list-widget-content">
              <span className="list-widget-name">{item.name}</span>
              {item.detail && (
                <span className="list-widget-detail">{item.detail}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ListWidget;
