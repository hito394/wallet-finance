import type { ReactNode } from 'react';
import clsx from 'clsx';

interface Props {
  title: string;
  value: string;
  sub?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'green' | 'red' | 'blue';
}

const colorMap = {
  default: 'text-gray-800',
  green:   'text-emerald-600',
  red:     'text-red-500',
  blue:    'text-brand-600',
};

export function SummaryCard({ title, value, sub, icon, color = 'default' }: Props) {
  return (
    <div className="card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={clsx('text-2xl font-bold tabular-nums', colorMap[color])}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
