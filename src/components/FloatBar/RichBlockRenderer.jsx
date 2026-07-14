/**
 * Detects registered :::type blocks in message content and renders them inline.
 * Plain text keeps the existing TypewriterMessage and EmailRenderer behavior.
 */
import React, { useMemo } from 'react';
import { BarChart3, Cloud, List, Newspaper, Table2, Zap } from 'lucide-react';
import TypewriterMessage from '../TypewriterMessage/TypewriterMessage';
import EmailRenderer from './EmailRenderer';
import { getBlock } from './blocks/blockRegistry';

const COMPLETE_BLOCK_PATTERN = /:::([a-z_]+)\r?\n([\s\S]*?)\r?\n:::/g;
const PARTIAL_BLOCK_PATTERN = /:::([a-z_]+)\r?\n[\s\S]*$/;
const SKELETON_ICONS = {
  weather: Cloud,
  news: Newspaper,
  list: List,
  fact: Zap,
  table: Table2,
  chart: BarChart3,
};

function parseBlock(definition, rawJson) {
  const parsedData = JSON.parse(rawJson.trim());
  return {
    definition,
    data: definition.parse ? definition.parse(parsedData) : parsedData,
  };
}

function splitCompleteBlocks(text) {
  const segments = [];
  let lastIndex = 0;
  COMPLETE_BLOCK_PATTERN.lastIndex = 0;

  let match;
  while ((match = COMPLETE_BLOCK_PATTERN.exec(text)) !== null) {
    const definition = getBlock(match[1]);
    if (!definition) continue;

    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    try {
      const block = parseBlock(definition, match[2]);
      segments.push({
        type: 'block',
        blockType: match[1],
        content: match[0],
        ...block,
      });
    } catch {
      segments.push({ type: 'text', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  return { segments, lastIndex };
}

function splitRichBlocks(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const { segments, lastIndex } = splitCompleteBlocks(text);
  const remaining = text.slice(lastIndex);
  const partialMatch = remaining.match(PARTIAL_BLOCK_PATTERN);
  const partialDefinition = partialMatch ? getBlock(partialMatch[1]) : null;

  if (partialMatch && partialDefinition) {
    const textBefore = remaining.slice(0, partialMatch.index);
    if (textBefore) segments.push({ type: 'text', content: textBefore });
    segments.push({
      type: 'skeleton',
      blockType: partialMatch[1],
      definition: partialDefinition,
      content: partialMatch[0],
    });
  } else if (remaining) {
    segments.push({ type: 'text', content: remaining });
  }

  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
}

/**
 * @param {string} content Full message content, which may contain display blocks.
 * @param {boolean} animate Whether plain text uses TypewriterMessage.
 */
const RichBlockRenderer = React.memo(function RichBlockRenderer({ content, animate = false }) {
  const segments = useMemo(() => splitRichBlocks(content), [content]);
  const hasDisplayBlocks = segments.some((segment) => segment.type !== 'text');

  if (!hasDisplayBlocks && segments.length === 1) {
    if (animate) {
      return <TypewriterMessage content={content} speed={120} enabled={true} />;
    }
    return <EmailRenderer content={content} />;
  }

  const reordered = [
    ...segments.filter((segment) => segment.type === 'text'),
    ...segments.filter((segment) => segment.type === 'block'),
    ...segments.filter((segment) => segment.type === 'skeleton'),
  ];

  return (
    <div className="rich-block-renderer">
      {reordered.map((segment, index) => {
        if (segment.type === 'text') {
          const trimmed = segment.content.trim();
          if (!trimmed) return null;
          return (
            <div key={index} className="rich-block-text-segment">
              <EmailRenderer content={trimmed} />
            </div>
          );
        }

        if (segment.type === 'skeleton') {
          const SkeletonIcon = SKELETON_ICONS[segment.blockType] || Cloud;
          return (
            <div key={index} className="display-card rich-widget-skeleton" role="status">
              <SkeletonIcon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span className="rich-widget-skeleton-text">{segment.definition.skeletonLabel}</span>
            </div>
          );
        }

        const BlockComponent = segment.definition.component;
        return <BlockComponent key={index} data={segment.data} />;
      })}
    </div>
  );
});

export default RichBlockRenderer;
