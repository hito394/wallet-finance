'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  Upload,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/',            label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/transactions', label: '取引',          icon: ArrowLeftRight  },
  { href: '/receipts',    label: 'レシート',       icon: Receipt         },
  { href: '/imports',     label: 'インポート',     icon: Upload          },
  { href: '/settings',    label: '設定',           icon: Settings        },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden md:flex md:w-56 shrink-0 md:flex-col bg-white border-r border-gray-100 md:h-screen md:sticky md:top-0">
        {/* ロゴ */}
        <div className="px-5 py-6 border-b border-gray-100">
          <h1 className="text-lg font-bold text-brand-500 tracking-tight">
            💰 家計簿
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Personal Finance</p>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                )}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">v0.1.0 · MVP</p>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur">
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={clsx(
                    'flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium',
                    isActive ? 'text-brand-600' : 'text-gray-500'
                  )}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="leading-none">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
