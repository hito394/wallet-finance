import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: '家計簿アプリ',
  description: '銀行明細・レシートから自動で家計を管理',
  manifest: '/manifest.webmanifest',
  themeColor: '#f8f9fc',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '家計簿アプリ',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-surface">
        <div className="min-h-screen md:flex">
          <Sidebar />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
