import React, { useId, useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_KINDS = new Set(['bar', 'line', 'area', 'pie']);
const CHART_COLORS = [
  'var(--display-block-accent, #6f91c9)',
  'var(--display-block-series-2, #91a6c2)',
  'var(--display-block-series-3, #73859e)',
  'var(--display-block-series-4, #b0bdcd)',
];

export function parseChartBlockData(data) {
  const isSimplified = Array.isArray(data?.labels) && Array.isArray(data?.values);

  if (isSimplified) {
    const hasValidValues =
      data.labels.length === data.values.length &&
      data.labels.every((label) => typeof label === 'string' || typeof label === 'number') &&
      data.values.every((value) => typeof value === 'number' && Number.isFinite(value));
    if (!hasValidValues || (data.kind && !CHART_KINDS.has(data.kind))) {
      throw new TypeError('Simplified chart blocks require matching labels and numeric values.');
    }
    return data;
  }

  const xKey = data?.x_key || 'x';
  const hasValidSeries =
    CHART_KINDS.has(data?.kind) &&
    Array.isArray(data.series) &&
    data.series.length > 0 &&
    data.series.every(
      (series) =>
        typeof series?.name === 'string' &&
        Array.isArray(series.data) &&
        series.data.every(
          (point) =>
            point &&
            (typeof (point[xKey] ?? point.x) === 'string' ||
              typeof (point[xKey] ?? point.x) === 'number') &&
            typeof point.y === 'number' &&
            Number.isFinite(point.y)
        )
    );

  if (!hasValidSeries) {
    throw new TypeError('Chart blocks require a supported kind and valid series data.');
  }

  return data;
}

function normalizeChartData(data) {
  if (Array.isArray(data.labels) && Array.isArray(data.values)) {
    return {
      kind: data.kind || 'bar',
      series: [
        {
          key: 'series_0',
          name: data.series_name || 'Value',
          data: data.labels.map((label, index) => ({ x: label, y: data.values[index] })),
        },
      ],
    };
  }

  const xKey = data.x_key || 'x';
  return {
    kind: data.kind,
    series: data.series.map((series, index) => ({
      key: `series_${index}`,
      name: series.name,
      data: series.data.map((point) => ({ x: point[xKey] ?? point.x, y: point.y })),
    })),
  };
}

function buildCartesianRows(series) {
  const rows = new Map();

  series.forEach((item) => {
    item.data.forEach((point) => {
      const rowKey = `${typeof point.x}:${String(point.x)}`;
      if (!rows.has(rowKey)) rows.set(rowKey, { x: point.x });
      rows.get(rowKey)[item.key] = point.y;
    });
  });

  return Array.from(rows.values());
}

const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: 'var(--display-block-text-muted, #91a0b5)', fontSize: 10 },
};

const tooltipProps = {
  cursor: { fill: 'var(--display-block-tooltip-cursor, rgba(111, 145, 201, 0.08))' },
  contentStyle: {
    background: 'var(--display-block-tooltip-bg, rgba(19, 27, 42, 0.96))',
    border: '1px solid var(--display-block-border, rgba(255, 255, 255, 0.12))',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
    color: 'var(--display-block-text, rgba(255, 255, 255, 0.92))',
    fontSize: 11,
  },
  itemStyle: { color: 'var(--display-block-text, rgba(255, 255, 255, 0.92))' },
  labelStyle: { color: 'var(--display-block-text-muted, #91a0b5)' },
};

const ChartBlock = React.memo(function ChartBlock({ data }) {
  const gradientId = useId().replace(/:/g, '');
  const normalized = useMemo(() => normalizeChartData(data), [data]);
  const cartesianRows = useMemo(() => buildCartesianRows(normalized.series), [normalized.series]);

  const commonCartesianChildren = (
    <>
      <XAxis dataKey="x" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
      <YAxis {...axisProps} width={30} tickCount={4} />
      <Tooltip {...tooltipProps} />
    </>
  );

  let chart;
  if (normalized.kind === 'line') {
    chart = (
      <LineChart
        data={cartesianRows}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        {commonCartesianChildren}
        {normalized.series.map((series, index) => (
          <Line
            key={series.key}
            type="monotone"
            dataKey={series.key}
            name={series.name}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    );
  } else if (normalized.kind === 'area') {
    chart = (
      <AreaChart
        data={cartesianRows}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        <defs>
          {normalized.series.map((series, index) => (
            <linearGradient
              key={series.key}
              id={`${gradientId}-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                stopOpacity={0.28}
              />
              <stop
                offset="100%"
                stopColor={CHART_COLORS[index % CHART_COLORS.length]}
                stopOpacity={0.02}
              />
            </linearGradient>
          ))}
        </defs>
        {commonCartesianChildren}
        {normalized.series.map((series, index) => (
          <Area
            key={series.key}
            type="monotone"
            dataKey={series.key}
            name={series.name}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#${gradientId}-${index})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </AreaChart>
    );
  } else if (normalized.kind === 'pie') {
    const pieData = normalized.series[0].data.map((point) => ({ name: point.x, value: point.y }));
    chart = (
      <PieChart accessibilityLayer>
        <Tooltip {...tooltipProps} cursor={false} />
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="46%"
          outerRadius="76%"
          paddingAngle={2}
          stroke="none"
        >
          {pieData.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  } else {
    chart = (
      <BarChart
        data={cartesianRows}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        {commonCartesianChildren}
        {normalized.series.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.name}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[4, 4, 1, 1]}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <section className="rich-widget display-block display-block-chart">
      {data.title && <h3 className="display-block-title">{data.title}</h3>}
      <div
        className="display-block-chart-canvas"
        role="img"
        aria-label={data.title || `${normalized.kind} chart`}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chart}
        </ResponsiveContainer>
      </div>
    </section>
  );
});

export default ChartBlock;
