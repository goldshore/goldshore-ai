import React, { useState } from 'react';

interface FilterOption {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterOption[];
  onFilter: (filters: Record<string, string>) => void;
  onSearch?: (query: string) => void;
}

export function FilterBar({ filters, onFilter, onSearch }: FilterBarProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterChange = (key: string, value: string) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);
    onFilter(newValues);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleReset = () => {
    setValues({});
    setSearchQuery('');
    onFilter({});
    onSearch?.('');
  };

  return (
    <div className="gs-card p-4 space-y-4">
      {onSearch && (
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-3 py-2 text-sm border rounded gs-input"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filters.map((filter) => (
          <div key={filter.key}>
            {filter.type === 'select' ? (
              <select
                value={values[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded gs-input"
              >
                <option value="">{filter.label}</option>
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={filter.type}
                placeholder={filter.placeholder || filter.label}
                value={values[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded gs-input"
              />
            )}
          </div>
        ))}

        <button
          onClick={handleReset}
          className="px-3 py-2 text-sm border rounded gs-text-subtle hover:bg-opacity-50"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
