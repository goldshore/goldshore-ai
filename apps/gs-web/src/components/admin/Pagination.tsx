import React from 'react';

interface PaginationProps {
  total: number;
  offset: number;
  limit: number;
  onOffsetChange: (offset: number) => void;
}

export function Pagination({ total, offset, limit, onOffsetChange }: PaginationProps) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const handlePrevious = () => {
    const newOffset = Math.max(0, offset - limit);
    onOffsetChange(newOffset);
  };

  const handleNext = () => {
    const newOffset = offset + limit;
    if (newOffset < total) {
      onOffsetChange(newOffset);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-opacity-50">
      <div className="text-sm gs-text-subtle">
        Showing {Math.min(offset + 1, total)}-{Math.min(offset + limit, total)} of {total}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handlePrevious}
          disabled={offset === 0}
          className="px-3 py-2 text-sm border rounded gs-text-subtle disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-50"
        >
          Previous
        </button>

        <div className="text-sm gs-text-subtle">
          Page {page} of {totalPages}
        </div>

        <button
          onClick={handleNext}
          disabled={offset + limit >= total}
          className="px-3 py-2 text-sm border rounded gs-text-subtle disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-50"
        >
          Next
        </button>
      </div>

      <select
        value={limit}
        onChange={(e) => onOffsetChange(0)}
        className="px-3 py-2 text-sm border rounded gs-input"
      >
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
  );
}
