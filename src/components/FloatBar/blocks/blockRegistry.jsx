import WeatherWidget from '../widgets/WeatherWidget';
import NewsWidget from '../widgets/NewsWidget';
import ListWidget from '../widgets/ListWidget';
import ChartBlock, { parseChartBlockData } from './ChartBlock';
import TableBlock, { parseTableBlockData } from './TableBlock';
import '../widgets/widgets.css';
import './blocks.css';

const blockRegistry = new Map();
const BLOCK_TYPE_PATTERN = /^[a-z_]+$/;

export function registerBlock(type, definition) {
  if (typeof type !== 'string' || !BLOCK_TYPE_PATTERN.test(type)) {
    throw new TypeError('Display block types must contain only lowercase letters and underscores.');
  }
  if (!definition?.component || typeof definition.skeletonLabel !== 'string') {
    throw new TypeError(`Display block "${type}" requires a component and skeletonLabel.`);
  }
  if (definition.parse && typeof definition.parse !== 'function') {
    throw new TypeError(`Display block "${type}" parse must be a function.`);
  }

  const registeredDefinition = Object.freeze({ ...definition });
  blockRegistry.set(type, registeredDefinition);
  return registeredDefinition;
}

export function getBlock(type) {
  return blockRegistry.get(type);
}

export function knownBlockTypes() {
  return Array.from(blockRegistry.keys());
}

registerBlock('weather', {
  component: WeatherWidget,
  skeletonLabel: 'Loading weather...',
});

registerBlock('news', {
  component: NewsWidget,
  skeletonLabel: 'Loading headlines...',
});

registerBlock('list', {
  component: ListWidget,
  skeletonLabel: 'Loading list...',
});

registerBlock('table', {
  component: TableBlock,
  skeletonLabel: 'Building table...',
  parse: parseTableBlockData,
});

registerBlock('chart', {
  component: ChartBlock,
  skeletonLabel: 'Drawing chart...',
  parse: parseChartBlockData,
});

// eslint-disable-next-line no-console -- Required module-load registry sanity note.
console.debug('[Display blocks] Registered types:', knownBlockTypes().join(', '));
