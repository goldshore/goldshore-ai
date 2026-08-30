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
    <div className="gs-row gs-row--between">
      <div className="gs-text-subtle">
        Showing {Math.min(offset + 1, total)}-{Math.min(offset + limit, total)} of {total}
      </div>

      <div className="gs-row">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={offset === 0}
          className="gs-button gs-button--secondary gs-button--small"
        >
          Previous
        </button>

        <div className="gs-text-subtle">
          Page {page} of {totalPages}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={offset + limit >= total}
          className="gs-button gs-button--secondary gs-button--small"
        >
          Next
        </button>
      </div>

      {/* NOTE: this select is inert — it resets to the first page but never
          reports the new page size, because there is no onLimitChange prop to
          report it through. Left as-is here; fixing it changes the component's
          public API and every caller. */}
      <select value={limit} onChange={() => onOffsetChange(0)}>
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
  );
}
