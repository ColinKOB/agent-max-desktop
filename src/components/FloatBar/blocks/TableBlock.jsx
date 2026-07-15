import React, { useMemo } from 'react';
import { Table2 } from 'lucide-react';

export function parseTableBlockData(data) {
  const hasValidColumns =
    Array.isArray(data?.columns) &&
    data.columns.length > 0 &&
    data.columns.every((column) => typeof column === 'string');
  const hasValidRows =
    hasValidColumns &&
    Array.isArray(data?.rows) &&
    data.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length === data.columns.length &&
        row.every((value) => typeof value === 'string' || typeof value === 'number')
    );

  if (!hasValidColumns || !hasValidRows) {
    throw new TypeError('Table blocks require string columns and equally sized rows.');
  }

  return data;
}

// Backend render tools can only send string cells (strict schemas forbid unions),
// so numeric-looking strings like "42", "$1,299", or "87%" count as numeric too.
function toNumeric(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.trim().replace(/^[$€£]/, '').replace(/%$/, '').replace(/,/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
}

const TableBlock = React.memo(function TableBlock({ data }) {
  const numericColumns = useMemo(
    () =>
      data.columns.map(
        (_, columnIndex) =>
          data.rows.length > 0 && data.rows.every((row) => !Number.isNaN(toNumeric(row[columnIndex])))
      ),
    [data.columns, data.rows]
  );

  const bestValues = useMemo(() => {
    if (!data.highlight_best) return [];

    return numericColumns.map((isNumeric, columnIndex) => {
      if (!isNumeric) return undefined;
      return Math.max(...data.rows.map((row) => toNumeric(row[columnIndex])));
    });
  }, [data.highlight_best, data.rows, numericColumns]);

  return (
    <section className="display-card display-block display-block-table">
      {data.title && (
        <h3 className="display-card-label display-block-title">
          <Table2 size={15} strokeWidth={1.75} aria-hidden="true" />
          <span>{data.title}</span>
        </h3>
      )}
      <div
        className="display-block-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={data.title || 'Data table'}
      >
        <table className="display-block-table-grid">
          <thead>
            <tr>
              {data.columns.map((column, columnIndex) => (
                <th
                  key={`${column}-${columnIndex}`}
                  scope="col"
                  className={numericColumns[columnIndex] ? 'is-numeric' : undefined}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((value, columnIndex) => {
                  const isBest =
                    data.highlight_best &&
                    numericColumns[columnIndex] &&
                    toNumeric(value) === bestValues[columnIndex];

                  return (
                    <td
                      key={columnIndex}
                      className={
                        [numericColumns[columnIndex] ? 'is-numeric' : '', isBest ? 'is-best' : '']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});

export default TableBlock;
