"use client";

import { useEffect, useState } from "react";
import { fetchSubscriptions } from "@/lib/api";
import type { SubscriptionServiceItem, SubscriptionsDetailResponse } from "@/lib/api";

// ─── アイコン ─────────────────────────────────────────────────────────────────

const SUBSCRIPTION_DOMAIN_MAP: Record<string, string> = {
  // US – Streaming
  "netflix": "netflix.com", "hulu": "hulu.com", "disney": "disneyplus.com",
  "hbo": "hbomax.com", "max": "max.com", "peacock": "peacocktv.com",
  "paramount": "paramountplus.com", "apple tv": "apple.com", "espn": "espnplus.com",
  "crunchyroll": "crunchyroll.com", "funimation": "funimation.com",
  // US – Music
  "spotify": "spotify.com", "apple music": "apple.com", "tidal": "tidal.com",
  "pandora": "pandora.com", "audible": "audible.com", "sirius": "siriusxm.com",
  // US – Tech / SaaS
  "amazon": "amazon.com", "apple": "apple.com", "google": "google.com",
  "microsoft": "microsoft.com", "adobe": "adobe.com", "dropbox": "dropbox.com",
  "notion": "notion.so", "slack": "slack.com", "figma": "figma.com",
  "canva": "canva.com", "zoom": "zoom.us", "github": "github.com",
  "openai": "openai.com", "chatgpt": "openai.com", "anthropic": "anthropic.com",
  "grammarly": "grammarly.com", "duolingo": "duolingo.com", "nordvpn": "nordvpn.com",
  "expressvpn": "expressvpn.com", "lastpass": "lastpass.com", "1password": "1password.com",
  "evernote": "evernote.com", "trello": "trello.com", "asana": "asana.com",
  "monday": "monday.com", "airtable": "airtable.com", "shopify": "shopify.com",
  "hubspot": "hubspot.com", "mailchimp": "mailchimp.com", "stripe": "stripe.com",
  "heroku": "heroku.com", "digitalocean": "digitalocean.com", "cloudflare": "cloudflare.com",
  "datadog": "datadoghq.com", "new relic": "newrelic.com",
  // US – Health / Fitness
  "peloton": "onepeloton.com", "calm": "calm.com", "headspace": "headspace.com",
  "noom": "noom.com", "weight watchers": "weightwatchers.com", "planet fitness": "planetfitness.com",
  // US – News / Media
  "new york times": "nytimes.com", "nytimes": "nytimes.com",
  "washington post": "washingtonpost.com", "wall street journal": "wsj.com",
  "economist": "economist.com", "bloomberg": "bloomberg.com",
  // US – Gaming
  "nintendo": "nintendo.com", "playstation": "playstation.com", "xbox": "xbox.com",
  "steam": "steampowered.com", "epic games": "epicgames.com", "twitch": "twitch.tv",
  "ea": "ea.com", "blizzard": "blizzard.com", "ubisoft": "ubisoft.com",
  // Japan – Streaming
  "abema": "abema.tv", "u-next": "video.unext.jp", "unext": "video.unext.jp",
  "dazn": "dazn.com", "niconico": "nicovideo.jp", "dmm": "dmm.com",
  "nhk": "nhk.or.jp", "tver": "tver.jp",
  // Japan – Telecom
  "docomo": "docomo.ne.jp", "softbank": "softbank.jp", "au": "au.com",
  "rakuten mobile": "network.mobile.rakuten.co.jp", "rakuten": "rakuten.co.jp",
  // Japan – Tech
  "line": "line.me", "freee": "freee.co.jp", "money forward": "moneyforward.com",
  // Japan – Gaming
  "square enix": "square-enix.com", "bandai namco": "bandainamcoent.com",
  "konami": "konami.com", "capcom": "capcom.com", "sega": "sega.com",
  // Global – Cloud Storage
  "icloud": "apple.com", "onedrive": "microsoft.com", "google drive": "google.com",
  // Global – Social
  "youtube": "youtube.com", "twitter": "twitter.com", "linkedin": "linkedin.com",
  "discord": "discord.com",
};

function guessDomain(merchant: string, backendDomain: string | null): string | null {
  if (backendDomain) return backendDomain;
  const lower = merchant.toLowerCase();
  for (const [key, domain] of Object.entries(SUBSCRIPTION_DOMAIN_MAP)) {
    if (lower.includes(key)) return domain;
  }
  return null;
}

function ServiceIcon({ item }: { item: SubscriptionServiceItem }) {
  const [imgOk, setImgOk] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const domain = guessDomain(item.merchant, item.merchant_domain);
  const logoUrl = domain ? `https://logo.clearbit.com/${domain}` : null;

  const colors = [
    ["#6C5CE7", "#A29BFE"], ["#E17055", "#FAB1A0"], ["#00B894", "#55EFC4"],
    ["#0984E3", "#74B9FF"], ["#FDCB6E", "#E17055"], ["#FD79A8", "#E84393"],
  ];
  const initial = item.merchant.charAt(0).toUpperCase();
  const initials = item.merchant.slice(0, 2).toUpperCase();
  const [from, to] = colors[initial.charCodeAt(0) % colors.length];

  if (logoUrl && imgOk) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff", border: "1.5px solid #e8eef3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={item.merchant} style={{ width: 28, height: 28, objectFit: "contain" }} />
      </div>
    );
  }

  return (
    <div style={{ width: 40, height: 40, borderRadius: 10, background: `linear-gradient(135deg, ${from}, ${to})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative", overflow: "hidden", fontSize: 14, fontWeight: 700, color: "#fff" }}>
      {logoUrl && !imgErr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", opacity: 0 }} onLoad={() => setImgOk(true)} onError={() => setImgErr(true)} />
      )}
      <span>{initials}</span>
    </div>
  );
}

// ─── メインウィジェット ───────────────────────────────────────────────────────

interface Props {
  entityId?: string;
}

export default function SubscriptionsWidget({ entityId }: Props) {
  const [data, setData] = useState<SubscriptionsDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions(entityId).then(r => {
      setData(r.data);
      setLoading(false);
    });
  }, [entityId]);

  const totalMonthly = data?.total_monthly ?? 0;
  const totalAnnual = Math.round(totalMonthly * 12);
  const items = data?.subscriptions ?? [];

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      {/* ヘッダー */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#10212f" }}>サブスクリプション</h3>
        {!loading && items.length > 0 && (
          <span style={{ fontSize: 12, color: "#5f7284" }}>{items.length}件</span>
        )}
      </div>

      {/* 合計バナー */}
      {!loading && items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: 12, marginBottom: 16, background: "linear-gradient(140deg,#eff6ff 0%,#fff 100%)", border: "1px solid #bfdbfe" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.4px" }}>月額合計</p>
            <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#1e40af", lineHeight: 1 }}>
              ${totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>年間換算</p>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: "#374151" }}>
              ${totalAnnual.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div style={{ display: "grid", gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 56, borderRadius: 10, background: "#f1f5f9", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}

      {/* 空の状態 */}
      {!loading && items.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 28, margin: "0 0 8px" }}>📱</p>
          <p style={{ fontSize: 13, margin: 0 }}>サブスクが見つかりません</p>
          <p style={{ fontSize: 11, margin: "6px 0 0", color: "#cbd5e1" }}>
            取引を "Subscriptions" カテゴリに設定すると表示されます
          </p>
        </div>
      )}

      {/* リスト */}
      {!loading && items.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map(item => (
            <div
              key={item.merchant}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e8eef3" }}
            >
              <ServiceIcon item={item} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#10212f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.merchant}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#5f7284" }}>
                  最終: {item.last_charge_date} · {item.charge_count}回
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#10212f" }}>
                  ${item.monthly_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>/月</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
