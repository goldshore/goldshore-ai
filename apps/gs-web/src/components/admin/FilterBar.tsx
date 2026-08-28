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
    <div className="gs-card gs-stack-sm">
      {onSearch && (
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={handleSearchChange}
          className="gs-input"
        />
      )}

      <div>
        {filters.map((filter) => (
          <div key={filter.key}>
            {filter.type === 'select' ? (
              <select
                value={values[filter.key] || ''}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                className="gs-input"
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
                className="gs-input"
              />
            )}
          </div>
        ))}

        <button
          onClick={handleReset}
          className="gs-text-subtle"
        >
          Reset Filters
        </button>
      </div>
    </div>
  );
}
