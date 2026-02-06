/**
 * RichBlockRenderer - Detects :::type blocks in message content and renders
 * them as polished widgets. Plain text passes through to TypewriterMessage
 * (animated) or EmailRenderer (static). Handles partial/streaming blocks
 * with skeleton placeholders.
 */
import React, { useMemo } from 'react';
import TypewriterMessage from '../TypewriterMessage/TypewriterMessage';
import EmailRenderer from './EmailRenderer';
import WeatherWidget from './widgets/WeatherWidget';
import NewsWidget from './widgets/NewsWidget';
import ListWidget from './widgets/ListWidget';
import './widgets/widgets.css';

// Regex to match complete :::type blocks (primary format)
const RICH_BLOCK_PATTERN = /:::(weather|news|list)\n([\s\S]*?)\n:::/g;

// Regex to detect an opening :::type that hasn't been closed yet
const PARTIAL_BLOCK_PATTERN = /:::(weather|news|list)\n[\s\S]*$/;

const SKELETON_LABELS = {
  weather: { icon: '🌤️', text: 'Loading weather...' },
  news: { icon: '📰', text: 'Loading headlines...' },
  list: { icon: '📋', text: 'Loading list...' },
};

/**
 * Split content into segments: plain text and rich blocks.
 * Returns an array of { type: 'text'|'weather'|'news'|'list', content: string, data?: object }
 */
function splitWithPattern(text, pattern) {
  const segments = [];
  let lastIndex = 0;
  pattern.lastIndex = 0;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    // Text before this block
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Parse the JSON data — the type is in group 1, JSON in group 2
    const blockType = match[1];
    const jsonStr = match[2].trim();
    try {
      const data = JSON.parse(jsonStr);
      segments.push({ type: blockType, content: match[0], data });
    } catch (e) {
      // If JSON is invalid, treat as plain text
      segments.push({ type: 'text', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  return { segments, lastIndex };
}

function splitRichBlocks(text) {
  if (!text) return [{ type: 'text', content: '' }];

  // Split on ::: delimited blocks
  let { segments, lastIndex } = splitWithPattern(text, RICH_BLOCK_PATTERN);

  // Check for a partial (unclosed) ::: block at the end
  const remaining = text.slice(lastIndex);
  const partialMatch = remaining.match(PARTIAL_BLOCK_PATTERN);

  if (partialMatch) {
    const textBefore = remaining.slice(0, partialMatch.index);
    if (textBefore) {
      segments.push({ type: 'text', content: textBefore });
    }
    segments.push({ type: 'skeleton', blockType: partialMatch[1], content: partialMatch[0] });
  } else if (remaining) {
    segments.push({ type: 'text', content: remaining });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}

/**
 * Render a widget based on block type
 */
function renderWidget(type, data, key) {
  switch (type) {
    case 'weather':
      return <WeatherWidget key={key} data={data} />;
    case 'news':
      return <NewsWidget key={key} data={data} />;
    case 'list':
      return <ListWidget key={key} data={data} />;
    default:
      return null;
  }
}

/**
 * RichBlockRenderer component
 * @param {string} content - The full message content (may contain :::type blocks)
 * @param {boolean} animate - Whether to use TypewriterMessage for text segments
 */
const RichBlockRenderer = React.memo(function RichBlockRenderer({ content, animate = false }) {
  const segments = useMemo(() => splitRichBlocks(content), [content]);

  // Fast path: if there's only plain text (no rich blocks), use existing renderers
  const hasRichBlocks = segments.some(s => s.type !== 'text');

  if (!hasRichBlocks && segments.length === 1) {
    if (animate) {
      return <TypewriterMessage content={content} speed={120} enabled={true} />;
    }
    return <EmailRenderer content={content} />;
  }

  return (
    <div className="rich-block-renderer">
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          const trimmed = segment.content.trim();
          if (!trimmed) return null;
          // For text segments, use EmailRenderer (handles both email detection and markdown)
          return (
            <div key={i} className="rich-block-text-segment">
              <EmailRenderer content={trimmed} />
            </div>
          );
        }

        if (segment.type === 'skeleton') {
          const info = SKELETON_LABELS[segment.blockType] || SKELETON_LABELS.list;
          return (
            <div key={i} className="rich-widget-skeleton">
              <span className="rich-widget-skeleton-icon">{info.icon}</span>
              <span className="rich-widget-skeleton-text">{info.text}</span>
            </div>
          );
        }

        // Rich block widget
        return renderWidget(segment.type, segment.data, i);
      })}
    </div>
  );
});

export default RichBlockRenderer;
