'use client';

import { useState } from 'react';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  onFilterChange: (filters: Record<string, string>) => void;
  searchPlaceholder?: string;
}

export default function FilterBar({ filters, onFilterChange, searchPlaceholder = 'Search...' }: FilterBarProps) {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (key: string, value: string) => {
    const newValues = { ...values, [key]: value };
    setValues(newValues);
    onFilterChange(newValues);
  };

  const clearAll = () => {
    setValues({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.values(values).some((v) => v !== '' && v !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      {filters.map((filter) => {
        if (filter.type === 'text') {
          return (
            <div key={filter.key} className="relative group">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={filter.placeholder || searchPlaceholder}
                className="pl-9 pr-4 py-2 bg-white/5 border-2 border-white/10 text-sm text-white focus:outline-none focus:border-accent transition-all w-56 placeholder-white/30"
                value={values[filter.key] || ''}
                onChange={(e) => handleChange(filter.key, e.target.value)}
              />
            </div>
          );
        }
        if (filter.type === 'select') {
          return (
            <select
              key={filter.key}
              className="px-3 py-2 bg-white/5 border-2 border-white/10 text-sm text-white/60 focus:outline-none focus:border-accent transition-all cursor-pointer"
              value={values[filter.key] || ''}
              onChange={(e) => handleChange(filter.key, e.target.value)}
            >
              <option value="">{filter.label}</option>
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          );
        }
        if (filter.type === 'date') {
          return (
            <input
              key={filter.key}
              type="date"
              className="px-3 py-2 bg-white/5 border-2 border-white/10 text-sm text-white/60 focus:outline-none focus:border-accent transition-all"
              value={values[filter.key] || ''}
              onChange={(e) => handleChange(filter.key, e.target.value)}
            />
          );
        }
        return null;
      })}

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors uppercase tracking-wider"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
