import React, { useState, useEffect, useRef } from 'react';
import { useAuthToken } from '../../utils/auth';

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
  const { token } = useAuthToken();

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
            headers: {
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
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
    <div className="gs-stack-sm">
      <h2>{title}</h2>

      {error && (
        <div className="gs-alert gs-alert--error">
          {error}
        </div>
      )}

      {loading ? (
        <div className="gs-card">
          <div className="gs-stack-sm">
            <div>
              <div className="gs-row">
                {columns.map((col) => (
                  <div key={String(col.key)} className="gs-skeleton gs-skeleton--grow" />
                ))}
                {actions && <div className="gs-skeleton gs-skeleton--sm" />}
              </div>
            </div>
            {Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
              <div key={idx} className="gs-row">
                {columns.map((col) => (
                  <div key={String(col.key)} className="gs-skeleton gs-skeleton--grow" />
                ))}
                {actions && <div className="gs-skeleton gs-skeleton--sm" />}
              </div>
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="gs-empty gs-text-subtle">
          No {title.toLowerCase()} found
        </div>
      ) : (
        <>
          <div className="gs-table-scroll gs-card">
            <table className="gs-admin-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={String(col.key)}>
                      {col.label}
                    </th>
                  ))}
                  {actions && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr
                    key={row.id || idx}>
                    {columns.map((col) => (
                      <td key={String(col.key)}>
                        {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                      </td>
                    ))}
                    {actions && <td>{actions(row)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="gs-row gs-row--between">
            <p className="gs-text-subtle">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of{' '}
              {total}
            </p>
            <div className="gs-row">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="gs-button gs-button--ghost gs-button--small">
                ← Previous
              </button>
              <span>
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page>= totalPages}
                className="gs-button gs-button--ghost gs-button--small">
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
