import React from 'react';

export interface KpiGridProps {
  children: React.ReactNode;
  columnsClass?: string;
}

export const KpiGrid: React.FC<KpiGridProps> = ({
  children,
  columnsClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
}) => {
  return <div className={columnsClass}>{children}</div>;
};

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: string;
  iconBgClass?: string;
  iconColorClass?: string;
  valueColorClass?: string;
  subtitleColorClass?: string;
  isMono?: boolean;
  isActive?: boolean;
  activeColor?: 'indigo' | 'rose' | 'blue' | 'emerald' | 'purple';
  onClick?: () => void;
  titleTooltip?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgClass = 'bg-indigo-50',
  iconColorClass = 'text-indigo-600',
  valueColorClass = 'text-slate-900',
  subtitleColorClass = 'text-slate-500',
  isMono = false,
  isActive = false,
  activeColor = 'indigo',
  onClick,
  titleTooltip,
}) => {
  const isClickable = !!onClick;

  const activeStyles: Record<string, string> = {
    rose: 'border-rose-500 ring-2 ring-rose-500/10 bg-rose-50/20 shadow-xs',
    blue: 'border-blue-500 ring-2 ring-blue-500/10 bg-blue-50/20 shadow-xs',
    emerald: 'border-emerald-500 ring-2 ring-emerald-500/10 bg-emerald-50/20 shadow-xs',
    purple: 'border-purple-500 ring-2 ring-purple-500/10 bg-purple-50/20 shadow-xs',
    indigo: 'border-indigo-500 ring-2 ring-indigo-500/10 bg-indigo-50/20 shadow-xs',
  };

  const activeClass = isActive
    ? (activeStyles[activeColor] || activeStyles.indigo)
    : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs bg-white';

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-5 transition-all select-none ${
        isClickable ? `cursor-pointer active:scale-[0.99] ${activeClass}` : 'border-slate-200/80 bg-white'
      }`}
      title={titleTooltip}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-xl ${iconBgClass} ${iconColorClass} flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
      </div>
      <div className={`text-2xl font-black ${valueColorClass} tracking-tight ${isMono ? 'font-mono' : ''}`}>
        {value}
      </div>
      <p className={`text-[11px] ${subtitleColorClass} mt-1 font-medium`}>
        {subtitle}
      </p>
    </div>
  );
};
