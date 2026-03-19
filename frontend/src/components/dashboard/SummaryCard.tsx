import clsx from 'clsx';

interface Props {
  title: string;
  value: string;
  sub?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'default' | 'green' | 'red' | 'blue' | 'purple';
}

const accentMap = {
  default: { border: '#2A2D42', value: '#E2E8F0', icon: '#475569' },
  green:   { border: '#4ADE80', value: '#4ADE80', icon: '#166534' },
  red:     { border: '#F87171', value: '#F87171', icon: '#991B1B' },
  blue:    { border: '#60A5FA', value: '#60A5FA', icon: '#1E3A5F' },
  purple:  { border: '#7C6FFF', value: '#7C6FFF', icon: '#2E1A6E' },
};

export function SummaryCard({ title, value, sub, icon, color = 'default' }: Props) {
  const accent = accentMap[color];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
      style={{
        backgroundColor: '#13151F',
        border: '1px solid #1E2030',
        borderTop: `2px solid ${accent.border}`,
      }}
    >
      {/* Subtle glow */}
      <div
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${accent.border}18 0%, transparent 100%)`,
        }}
      />

      <div className="flex items-center justify-between relative">
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: '#64748B' }}
        >
          {title}
        </p>
        {icon && (
          <span
            className="text-base w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent.icon + '40' }}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className="text-2xl font-bold tabular-nums relative"
        style={{ color: accent.value }}
      >
        {value}
      </p>

      {sub && (
        <p className="text-xs relative" style={{ color: '#475569' }}>
          {sub}
        </p>
      )}
    </div>
  );
}
