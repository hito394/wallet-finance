'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { getSubscriptions } from '@/lib/api';
import type { SubscriptionItem, SubscriptionsResponse } from '@/types';

// 有名サービスのemoji絵文字フォールバック（Clearbitが失敗した場合）
const SERVICE_EMOJI: Record<string, string> = {
  netflix: '🎬', spotify: '🎵', hulu: '📺', 'amazon prime': '📦',
  'prime video': '📦', 'youtube premium': '▶️', 'youtube music': '🎵',
  'apple music': '🎵', 'apple tv': '📺', 'apple one': '🍎',
  disney: '🏰', dazn: '⚽', abema: '📱', 'u-next': '📺',
  'amazon web': '☁️', aws: '☁️', 'google cloud': '☁️', azure: '☁️',
  dropbox: '📦', 'google one': '🔵', icloud: '☁️', notion: '📝',
  figma: '🎨', canva: '🎨', adobe: '🅰️', github: '💻', gitlab: '🦊',
  slack: '💬', zoom: '🎥', teams: '💼', chatgpt: '🤖', openai: '🤖',
  'microsoft 365': '💼', 'office 365': '💼', grammarly: '✍️',
  duolingo: '🦜', headspace: '🧘', calm: '😌', peloton: '🚴',
  '1password': '🔐', nordvpn: '🔒', audible: '🎧',
  'kindle unlimited': '📚', scribd: '📖',
};

// ─── サービスアイコン ─────────────────────────────────────────────────────────

function ServiceIcon({ item }: { item: SubscriptionItem }) {
  const [imgOk, setImgOk] = useState(false);
  const [imgError, setImgError] = useState(false);

  const logoUrl = item.merchant_domain
    ? `https://logo.clearbit.com/${item.merchant_domain}`
    : null;

  const initial = item.merchant.charAt(0).toUpperCase();
  const merchantLower = item.merchant.toLowerCase();
  const emoji = Object.entries(SERVICE_EMOJI).find(([k]) => merchantLower.includes(k))?.[1];

  const colors = [
    ['#6C5CE7', '#A29BFE'], ['#E17055', '#FAB1A0'], ['#00B894', '#55EFC4'],
    ['#0984E3', '#74B9FF'], ['#FDCB6E', '#E17055'], ['#FD79A8', '#E84393'],
    ['#636E72', '#B2BEC3'],
  ];
  const [from, to] = colors[initial.charCodeAt(0) % colors.length];

  // Clearbitロゴが正常に表示されている場合
  if (logoUrl && imgOk) {
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: '#fff' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={item.merchant} className="w-8 h-8 object-contain" />
      </div>
    );
  }

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {/* バックグラウンドでClearbitを試みる */}
      {logoUrl && !imgError && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain opacity-0"
          onLoad={() => setImgOk(true)}
          onError={() => setImgError(true)}
        />
      )}
      <span className="text-base leading-none" role="img">
        {emoji ?? initial}
      </span>
    </div>
  );
}

// ─── サブスクカード ───────────────────────────────────────────────────────────

function SubscriptionCard({ item }: { item: SubscriptionItem }) {
  const monthly = Math.round(parseFloat(item.monthly_amount));
  const lastDate = new Date(item.last_charge_date);
  const lastDateStr = lastDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
      style={{ backgroundColor: '#0E0F1A', border: '1px solid #1E2030' }}
    >
      <ServiceIcon item={item} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
          {item.merchant}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
          最終: {lastDateStr} · {item.charge_count}回
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: '#F1F5F9' }}>
          ¥{monthly.toLocaleString()}
        </p>
        <p className="text-xs" style={{ color: '#475569' }}>/月</p>
      </div>
    </div>
  );
}

// ─── メインウィジェット ───────────────────────────────────────────────────────

export function SubscriptionWidget() {
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getSubscriptions();
      setData(res);
    } catch (e) {
      setError('データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalMonthly = data ? Math.round(parseFloat(data.total_monthly)) : 0;
  const totalAnnual = totalMonthly * 12;

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
            サブスクリプション
          </h3>
          {data && (
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              {data.subscriptions.length}件登録中
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#1E2030', color: '#64748B' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 月額合計バナー */}
      {data && data.subscriptions.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
          style={{ background: 'linear-gradient(135deg, #1E2246 0%, #16192E 100%)', border: '1px solid #2A2D5A' }}
        >
          <div>
            <p className="text-xs font-medium" style={{ color: '#7C6FFF' }}>月額合計</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: '#F1F5F9' }}>
              ¥{totalMonthly.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium" style={{ color: '#475569' }}>年間換算</p>
            <p className="text-base font-semibold mt-0.5" style={{ color: '#94A3B8' }}>
              ¥{totalAnnual.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
              style={{ backgroundColor: '#1E2030' }}
            />
          ))}
        </div>
      )}

      {/* エラー */}
      {error && !loading && (
        <p className="text-sm text-center py-8" style={{ color: '#EF4444' }}>{error}</p>
      )}

      {/* データなし */}
      {!loading && !error && data && data.subscriptions.length === 0 && (
        <div className="text-center py-10">
          <p className="text-2xl mb-2">📱</p>
          <p className="text-sm" style={{ color: '#475569' }}>
            サブスクリプションが見つかりません
          </p>
          <p className="text-xs mt-1" style={{ color: '#334155' }}>
            取引をカテゴリ「サブスクリプション」に設定すると表示されます
          </p>
        </div>
      )}

      {/* サブスクリスト */}
      {!loading && !error && data && data.subscriptions.length > 0 && (
        <div className="space-y-2">
          {data.subscriptions.map(item => (
            <SubscriptionCard key={item.merchant} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
