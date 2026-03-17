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
  { href: '/',             label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/transactions', label: '取引',           icon: ArrowLeftRight  },
  { href: '/receipts',     label: 'レシート',        icon: Receipt         },
  { href: '/imports',      label: 'インポート',      icon: Upload          },
  { href: '/settings',     label: '設定',            icon: Settings        },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* ─── Desktop sidebar ─── */}
      <aside
        className="hidden md:flex md:w-56 shrink-0 md:flex-col md:h-screen md:sticky md:top-0"
        style={{ backgroundColor: '#0E0F1A', borderRight: '1px solid #1E2030' }}
      >
        {/* Logo */}
        <div className="px-5 py-6" style={{ borderBottom: '1px solid #1E2030' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #7C6FFF 0%, #4ADE80 100%)' }}
            >
              W
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight leading-none">
                Wallet
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>Personal Finance</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                )}
                style={
                  isActive
                    ? { backgroundColor: '#1E2246', color: '#7C6FFF' }
                    : { color: '#64748B' }
                }
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = '#161829';
                    (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = '#64748B';
                  }
                }}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{ flexShrink: 0 }}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid #1E2030' }}>
          <p className="text-[10px]" style={{ color: '#334155' }}>v0.1.0 · MVP</p>
        </div>
      </aside>

      {/* ─── Mobile bottom nav ─── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(14,15,26,0.95)', borderTop: '1px solid #1E2030' }}
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                  style={{ color: isActive ? '#7C6FFF' : '#475569' }}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
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
