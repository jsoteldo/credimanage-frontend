import React from 'react';

export interface PageHeaderProps {
  icon: string;
  iconBgClass?: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  iconBgClass = 'bg-indigo-600',
  title,
  subtitle,
  actions,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-9 h-9 rounded-2xl ${iconBgClass} text-white flex items-center justify-center font-bold shadow-xs shrink-0`}>
            <span className="material-symbols-outlined text-[22px]">{icon}</span>
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {title}
          </h2>
        </div>
        <p className="text-xs text-slate-500 font-medium">
          {subtitle}
        </p>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
