'use client';

import { useState } from 'react';
import { CalendarDays, BarChart2 } from 'lucide-react';
import { DashboardWidgets } from '@/components/dashboard/DashboardWidgets';
import { SpendingCalendar } from '@/components/calendar/SpendingCalendar';
import type { DashboardSummary, Transaction } from '@/types';

type Tab = 'calendar' | 'charts';

interface Props {
  dashboard: DashboardSummary;
  transactions: Transaction[];
}

export function HomeClient({ dashboard, transactions }: Props) {
  const [tab, setTab] = useState<Tab>('calendar');

  const tabs: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
    { key: 'calendar', label: 'カレンダー', icon: CalendarDays },
    { key: 'charts',   label: 'チャート',   icon: BarChart2    },
  ];

  return (
    <div>
      {/* Tab toggle */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
            style={
              tab === key
                ? { backgroundColor: '#1E2246', color: '#7C6FFF' }
                : { color: '#64748B' }
            }
          >
            <Icon size={14} strokeWidth={tab === key ? 2.5 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <SpendingCalendar initialMonth={dashboard.current_month} />
      )}
      {tab === 'charts' && (
        <DashboardWidgets dashboard={dashboard} transactions={transactions} />
      )}
    </div>
  );
}
