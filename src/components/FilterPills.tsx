import React from 'react';

export interface FilterPillOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

export interface FilterPillsProps<T extends string = string> {
  options: FilterPillOption<T>[];
  activeKey: T;
  onSelect: (key: T) => void;
  activeColor?: 'indigo' | 'rose';
}

export function FilterPills<T extends string = string>({
  options,
  activeKey,
  onSelect,
  activeColor = 'indigo',
}: FilterPillsProps<T>) {
  const activeBgClass =
    activeColor === 'rose'
      ? 'bg-rose-600 text-white shadow-2xs'
      : 'bg-indigo-600 text-white shadow-2xs';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => {
        const isActive = opt.key === activeKey;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSelect(opt.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? activeBgClass
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {opt.label}
            {typeof opt.count === 'number' ? ` (${opt.count})` : ''}
          </button>
        );
      })}
    </div>
  );
}
