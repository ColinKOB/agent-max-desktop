import React, { useMemo } from 'react';

export function parseTableBlockData(data) {
  const hasValidColumns =
    Array.isArray(data?.columns) &&
    data.columns.length > 0 &&
    data.columns.every((column) => typeof column === 'string');
  const hasValidRows =
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

const TableBlock = React.memo(function TableBlock({ data }) {
  const numericColumns = useMemo(
    () =>
      data.columns.map(
        (_, columnIndex) =>
          data.rows.length > 0 && data.rows.every((row) => typeof row[columnIndex] === 'number')
      ),
    [data.columns, data.rows]
  );

  const bestValues = useMemo(() => {
    if (!data.highlight_best) return [];

    return numericColumns.map((isNumeric, columnIndex) => {
      if (!isNumeric) return undefined;
      return Math.max(...data.rows.map((row) => row[columnIndex]));
    });
  }, [data.highlight_best, data.rows, numericColumns]);

  return (
    <section className="rich-widget display-block display-block-table">
      {data.title && <h3 className="display-block-title">{data.title}</h3>}
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
                    value === bestValues[columnIndex];

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
