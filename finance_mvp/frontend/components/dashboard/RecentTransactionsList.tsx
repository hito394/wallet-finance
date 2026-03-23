"use client";

import { useState } from "react";
import Link from "next/link";
import type { TransactionItem } from "@/lib/api";

type Props = {
  rows: TransactionItem[];
  entityId?: string;
};

const PALETTE = [
  "#0f766e","#22c55e","#3b82f6","#f59e0b",
  "#ef4444","#8b5cf6","#ec4899","#14b8a6",
  "#f97316","#6366f1",
];

const MERCHANT_DOMAIN_MAP: Record<string, string> = {
  "amazon": "amazon.com", "amazon prime": "amazon.com",
  "netflix": "netflix.com", "spotify": "spotify.com",
  "hulu": "hulu.com", "disney": "disneyplus.com",
  "youtube": "youtube.com", "apple": "apple.com",
  "google": "google.com", "microsoft": "microsoft.com",
  "adobe": "adobe.com", "dropbox": "dropbox.com",
  "notion": "notion.so", "slack": "slack.com",
  "figma": "figma.com", "canva": "canva.com",
  "zoom": "zoom.us", "github": "github.com",
  "openai": "openai.com", "chatgpt": "openai.com",
  "uber": "uber.com", "lyft": "lyft.com",
  "airbnb": "airbnb.com", "booking": "booking.com",
  "starbucks": "starbucks.com", "mcdonald": "mcdonalds.com",
  "target": "target.com", "walmart": "walmart.com",
  "costco": "costco.com", "whole foods": "wholefoods.com",
  "paypal": "paypal.com", "venmo": "venmo.com",
  "stripe": "stripe.com", "shopify": "shopify.com",
  "rakuten": "rakuten.co.jp", "nintendo": "nintendo.com",
  "playstation": "playstation.com", "xbox": "xbox.com",
  "nordvpn": "nordvpn.com", "grammarly": "grammarly.com",
  "duolingo": "duolingo.com", "docomo": "docomo.ne.jp",
  "softbank": "softbank.jp",
};

const MERCHANT_EMOJI: Record<string, string> = {
  "amazon": "📦", "netflix": "🎬", "spotify": "🎵",
  "hulu": "📺", "disney": "🏰", "youtube": "▶️",
  "apple": "🍎", "google": "🔵", "microsoft": "💼",
  "adobe": "🅰️", "notion": "📝", "slack": "💬",
  "figma": "🎨", "canva": "🎨", "zoom": "🎥",
  "github": "💻", "openai": "🤖", "chatgpt": "🤖",
  "uber": "🚗", "lyft": "🚗", "airbnb": "🏠",
  "starbucks": "☕", "mcdonald": "🍔",
  "target": "🎯", "walmart": "🛒", "costco": "🏬",
  "nintendo": "🎮", "playstation": "🕹️", "xbox": "🎮",
  "duolingo": "🦜", "paypal": "💳",
};

function guessDomain(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, domain] of Object.entries(MERCHANT_DOMAIN_MAP)) {
    if (lower.includes(key)) return domain;
  }
  return null;
}

function guessEmoji(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(MERCHANT_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return null;
}

function merchantColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function MerchantIcon({ merchant }: { merchant: string }) {
  const [imgOk, setImgOk] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const domain = guessDomain(merchant);
  const emoji = guessEmoji(merchant);
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const color = merchantColor(merchant);
  const initials = merchant.slice(0, 2).toUpperCase();

  if (logoUrl && imgOk) {
    return (
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "#fff",
        border: "1.5px solid #e8eef3",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, overflow: "hidden",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={merchant} style={{ width: 26, height: 26, objectFit: "contain" }} />
      </div>
    );
  }

  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: color + "20",
      border: `1.5px solid ${color}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: emoji ? 18 : 13, fontWeight: 800, color, flexShrink: 0,
      letterSpacing: "-0.5px", position: "relative", overflow: "hidden",
    }}>
      {logoUrl && !imgErr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0 }}
          onLoad={() => setImgOk(true)}
          onError={() => setImgErr(true)}
        />
      )}
      <span role={emoji ? "img" : undefined}>{emoji ?? initials}</span>
    </div>
  );
}

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function RecentTransactionsList({ rows, entityId }: Props) {
  const items = rows.slice(0, 10);
  const href = `/transactions${entityId ? `?entityId=${entityId}` : ""}`;

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#10212f" }}>最近の取引</h3>
        <Link href={href} style={{ fontSize: 13, color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
          すべて表示 →
        </Link>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>
          取引データがまだありません。明細をアップロードしてください。
        </div>
      ) : (
        <div style={{ display: "grid", gap: 2 }}>
          {items.map((row) => {
            const isCredit = row.direction === "credit";
            const merchant = row.merchant_normalized || row.merchant_raw;
            const amount = Number(row.amount);

            return (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  borderRadius: 10,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <MerchantIcon merchant={merchant} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#10212f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {merchant}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                    {fmtDate(row.transaction_date)}
                    {row.description && row.description !== merchant && (
                      <span style={{ marginLeft: 6 }}>· {row.description.slice(0, 28)}</span>
                    )}
                  </p>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 15, fontWeight: 700,
                    color: isCredit ? "#16a34a" : "#dc2626",
                  }}>
                    {isCredit ? "+" : "-"}{row.currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </p>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99,
                    background: isCredit ? "#dcfce7" : "#fee2e2",
                    color: isCredit ? "#16a34a" : "#dc2626",
                  }}>
                    {isCredit ? "収入" : "支出"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
