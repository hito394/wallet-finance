'use client';

import Link from 'next/link';
import type { Transaction } from '@/types';
import { formatDate, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/api';
import { ArrowRight } from 'lucide-react';

interface Props {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: '#475569' }}>
        取引データがまだありません。明細をインポートしてください。
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y" style={{ borderColor: '#1E2030' }}>
        {transactions.map((tx) => {
          const catColor = CATEGORY_COLORS[tx.category ?? 'other'] ?? '#2A2D42';
          const name = tx.merchant_normalized ?? tx.merchant_raw;
          const isCredit = tx.direction === 'credit';

          return (
            <div
              key={tx.id}
              className="flex items-center justify-between px-1 py-3 rounded-xl transition-colors cursor-default group"
              style={{ '--hover-bg': '#161829' } as React.CSSProperties}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#161829';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              {/* Avatar + info */}
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 select-none"
                  style={{
                    backgroundColor: catColor + '25',
                    color: catColor,
                    border: `1px solid ${catColor}40`,
                  }}
                >
                  {name.slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#CBD5E1' }}>
                    {name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    {formatDate(tx.transaction_date)}
                    <span className="mx-1" style={{ color: '#2A2D42' }}>·</span>
                    {CATEGORY_LABELS[tx.category ?? 'other'] ?? tx.category}
                  </p>
                </div>
              </div>

              {/* Amount */}
              <span
                className="text-sm font-semibold tabular-nums shrink-0 ml-4"
                style={{ color: isCredit ? '#4ADE80' : '#F1F5F9' }}
              >
                {isCredit ? '+' : '-'}¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-4 flex justify-end">
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-xs font-medium transition-colors"
          style={{ color: '#7C6FFF' }}
        >
          すべて表示
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
