'use client';

import Link from 'next/link';
import type { Transaction } from '@/types';
import { formatDate, formatAmount, CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/api';
import clsx from 'clsx';

interface Props {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        取引データがまだありません。明細をインポートしてください。
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y divide-gray-50">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between px-1 py-3 hover:bg-gray-50 rounded-xl transition-colors"
        >
          {/* 左: カテゴリバッジ + 店名 */}
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0"
              style={{ background: CATEGORY_COLORS[tx.category ?? 'other'] ?? '#DFE6E9' }}
            >
              {(tx.merchant_normalized ?? tx.merchant_raw).slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {tx.merchant_normalized ?? tx.merchant_raw}
              </p>
              <p className="text-xs text-gray-400">
                {formatDate(tx.transaction_date)} · {CATEGORY_LABELS[tx.category ?? 'other'] ?? tx.category}
              </p>
            </div>
          </div>

          {/* 右: 金額 */}
          <span
            className={clsx(
              'text-sm font-semibold tabular-nums shrink-0 ml-3',
              tx.direction === 'credit' ? 'text-emerald-600' : 'text-gray-800'
            )}
          >
            {tx.direction === 'credit' ? '+' : ''}
            ¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
          </span>
        </div>
      ))}
      <div className="pt-3 text-center">
        <Link href="/transactions" className="text-xs text-brand-500 hover:underline">
          すべて表示 →
        </Link>
      </div>
    </div>
  );
}
