import React from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  if (loading) {
    return <div className="gs-card gs-empty gs-text-subtle">Loading...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="gs-card gs-empty gs-text-subtle">{emptyMessage}</div>;
  }

  return (
    <div className="gs-table-scroll">
      <table className="gs-admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'gs-row-clickable' : undefined}
            >
              {columns.map((col) => (
                <td key={String(col.key)}>
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] || '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
