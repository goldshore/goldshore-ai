import React, { useState, useEffect, useRef } from 'react';

interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  endpoint: string;
  pageSize?: number;
  title: string;
  actions?: (row: T) => React.ReactNode;
  cacheTime?: number;
}

interface CacheEntry<T> {
  data: T[];
  total: number;
  timestamp: number;
}

const requestCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 60000;
let abortController: AbortController | null = null;

export default function DataTable<T extends { id?: string }>({
  columns,
  endpoint,
  pageSize = 10,
  title,
  actions,
  cacheTime = CACHE_TTL,
}: DataTableProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const cacheKey = `${endpoint}?page=${page}&limit=${pageSize}`;
      const cached = requestCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < cacheTime) {
        if (isMountedRef.current) {
          setData(cached.data);
          setTotal(cached.total);
          setLoading(false);
          setError(null);
        }
        return;
      }

      abortController = new AbortController();
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        const response = await Promise.race([
          fetch(`${endpoint}?${searchParams}`, {
            signal: abortController.signal,
          }),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 10000)
          ),
        ]);

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Authentication expired. Please refresh the page.'
              : `Failed to load data (HTTP ${response.status})`
          );
        }

        const result = await response.json();
        const tableData = result.items || result.data || [];
        const tableTotal = result.total || 0;

        if (isMountedRef.current) {
          requestCache.set(cacheKey, {
            data: tableData,
            total: tableTotal,
            timestamp: now,
          });

          setData(tableData);
          setTotal(tableTotal);
          setError(null);
          setRetryCount(0);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data';

        if (isMountedRef.current) {
          if (retryCount < 2 && !errorMsg.includes('Authentication')) {
            setRetryCount((c) => c + 1);
            setTimeout(fetchData, Math.pow(2, retryCount) * 1000);
          } else {
            setError(errorMsg);
            setData([]);
            setTotal(0);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController?.abort();
    };
  }, [endpoint, page, pageSize, cacheTime, retryCount]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{title}</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="w-full text-sm">
            <div className="bg-gray-50 border-b">
              <div className="px-4 py-3 flex gap-4">
                {columns.map((col) => (
                  <div key={String(col.key)} className="h-4 bg-gray-300 rounded animate-pulse flex-1" />
                ))}
                {actions && <div className="h-4 bg-gray-300 rounded animate-pulse w-20" />}
              </div>
            </div>
            {Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
              <div key={idx} className="border-b px-4 py-3 flex gap-4">
                {columns.map((col) => (
                  <div key={String(col.key)} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
                ))}
                {actions && <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />}
              </div>
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No {title.toLowerCase()} found
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {columns.map((col) => (
                    <th key={String(col.key)} className="px-4 py-3 text-left font-semibold">
                      {col.label}
                    </th>
                  ))}
                  {actions && <th className="px-4 py-3 text-left">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="border-b hover:bg-gray-50 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={String(col.key)} className="px-4 py-3">
                        {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                      </td>
                    ))}
                    {actions && <td className="px-4 py-3">{actions(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
              {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded"
              >
                ← Previous
              </button>
              <span className="px-4 py-2">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 hover:bg-gray-100 disabled:opacity-50 rounded"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
