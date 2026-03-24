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
  // US – EC / Retail
  "amazon": "amazon.com", "amazon prime": "amazon.com", "whole foods": "wholefoodsmarket.com",
  "walmart": "walmart.com", "target": "target.com", "costco": "costco.com",
  "best buy": "bestbuy.com", "home depot": "homedepot.com", "lowes": "lowes.com",
  "cvs": "cvs.com", "walgreens": "walgreens.com", "kroger": "kroger.com",
  "trader joe": "traderjoes.com", "h-e-b": "heb.com", "heb": "heb.com",
  "publix": "publix.com", "safeway": "safeway.com", "albertsons": "albertsons.com",
  "dollar general": "dollargeneral.com", "dollar tree": "dollartree.com",
  "tjmaxx": "tjmaxx.com", "tj maxx": "tjmaxx.com", "marshalls": "marshalls.com",
  "ross": "rossstores.com", "nordstrom": "nordstrom.com", "macy": "macys.com",
  "gap": "gap.com", "h&m": "hm.com", "zara": "zara.com", "uniqlo": "uniqlo.com",
  "nike": "nike.com", "adidas": "adidas.com", "under armour": "underarmour.com",
  "etsy": "etsy.com", "ebay": "ebay.com", "wayfair": "wayfair.com",
  "chewy": "chewy.com", "petsmart": "petsmart.com",
  // US – Food / Restaurants
  "starbucks": "starbucks.com", "mcdonald": "mcdonalds.com", "chick-fil-a": "chick-fil-a.com",
  "chickfila": "chick-fil-a.com", "chipotle": "chipotle.com", "subway": "subway.com",
  "taco bell": "tacobell.com", "burger king": "burgerking.com", "wendy": "wendys.com",
  "domino": "dominos.com", "pizza hut": "pizzahut.com", "panera": "panerabread.com",
  "dunkin": "dunkindonuts.com", "doordash": "doordash.com", "grubhub": "grubhub.com",
  "ubereats": "ubereats.com", "instacart": "instacart.com", "postmates": "postmates.com",
  "five guys": "fiveguys.com", "shake shack": "shakeshack.com", "wingstop": "wingstop.com",
  "olive garden": "olivegarden.com", "applebee": "applebees.com", "ihop": "ihop.com",
  "denny": "dennys.com",
  // US – Streaming / Entertainment
  "netflix": "netflix.com", "hulu": "hulu.com", "disney": "disneyplus.com",
  "hbo": "hbomax.com", "max": "max.com", "peacock": "peacocktv.com",
  "paramount": "paramountplus.com", "apple tv": "apple.com", "espn": "espnplus.com",
  "crunchyroll": "crunchyroll.com", "funimation": "funimation.com",
  // US – Music / Podcast
  "spotify": "spotify.com", "apple music": "apple.com", "tidal": "tidal.com",
  "pandora": "pandora.com", "audible": "audible.com", "sirius": "siriusxm.com",
  // US – Tech / SaaS
  "apple": "apple.com", "google": "google.com", "microsoft": "microsoft.com",
  "adobe": "adobe.com", "dropbox": "dropbox.com", "notion": "notion.so",
  "slack": "slack.com", "figma": "figma.com", "canva": "canva.com",
  "zoom": "zoom.us", "github": "github.com", "openai": "openai.com",
  "chatgpt": "openai.com", "anthropic": "anthropic.com", "claude": "anthropic.com",
  "grammarly": "grammarly.com", "duolingo": "duolingo.com", "nordvpn": "nordvpn.com",
  "expressvpn": "expressvpn.com", "lastpass": "lastpass.com", "1password": "1password.com",
  "evernote": "evernote.com", "trello": "trello.com", "asana": "asana.com",
  "monday": "monday.com", "airtable": "airtable.com", "webflow": "webflow.com",
  "squarespace": "squarespace.com", "wix": "wix.com", "shopify": "shopify.com",
  "hubspot": "hubspot.com", "salesforce": "salesforce.com", "zendesk": "zendesk.com",
  "mailchimp": "mailchimp.com", "twilio": "twilio.com", "stripe": "stripe.com",
  "heroku": "heroku.com", "digitalocean": "digitalocean.com", "linode": "linode.com",
  "cloudflare": "cloudflare.com", "datadog": "datadoghq.com",
  // US – Finance / Payment
  "paypal": "paypal.com", "venmo": "venmo.com", "cashapp": "cash.app",
  "square": "squareup.com", "chase": "chase.com", "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com", "citibank": "citibank.com", "td bank": "td.com",
  "capital one": "capitalone.com", "american express": "americanexpress.com",
  "amex": "americanexpress.com", "discover": "discover.com", "fidelity": "fidelity.com",
  "vanguard": "vanguard.com", "charles schwab": "schwab.com", "robinhood": "robinhood.com",
  "coinbase": "coinbase.com",
  // US – Transport / Travel
  "uber": "uber.com", "lyft": "lyft.com", "airbnb": "airbnb.com",
  "booking": "booking.com", "expedia": "expedia.com", "hotels.com": "hotels.com",
  "delta": "delta.com", "united": "united.com", "american airlines": "aa.com",
  "southwest": "southwest.com", "jetblue": "jetblue.com", "spirit": "spirit.com",
  "hilton": "hilton.com", "marriott": "marriott.com", "hyatt": "hyatt.com",
  "enterprise": "enterprise.com", "hertz": "hertz.com", "avis": "avis.com",
  "zipcar": "zipcar.com",
  // US – Health / Fitness
  "cvs pharmacy": "cvs.com", "rite aid": "riteaid.com",
  "planet fitness": "planetfitness.com", "equinox": "equinox.com",
  "peloton": "onepeloton.com", "calm": "calm.com", "headspace": "headspace.com",
  "noom": "noom.com", "weight watchers": "weightwatchers.com",
  // US – Telecom / Utilities
  "at&t": "att.com", "att": "att.com", "verizon": "verizon.com",
  "t-mobile": "t-mobile.com", "tmobile": "t-mobile.com", "comcast": "xfinity.com",
  "xfinity": "xfinity.com", "spectrum": "spectrum.com",
  // US – Gaming
  "nintendo": "nintendo.com", "playstation": "playstation.com", "xbox": "xbox.com",
  "steam": "steampowered.com", "epic games": "epicgames.com", "twitch": "twitch.tv",
  "ea": "ea.com", "blizzard": "blizzard.com", "ubisoft": "ubisoft.com",
  // Japan – EC / Retail
  "rakuten": "rakuten.co.jp", "yahoo japan": "yahoo.co.jp", "au pay": "au.com",
  "mercari": "mercari.com", "zozotown": "zozo.jp", "qoo10": "qoo10.jp",
  "yodobashi": "yodobashi.com", "bic camera": "biccamera.com", "yamada": "yamada-denki.co.jp",
  "ito-yokado": "itoyokado.com", "aeon": "aeon.co.jp", "seven eleven": "sej.co.jp",
  "lawson": "lawson.co.jp", "familymart": "family.co.jp", "ministop": "ministop.co.jp",
  "don quijote": "donki.com", "donki": "donki.com",
  "nitori": "nitori.co.jp", "ikea": "ikea.com", "muji": "muji.com",
  // Japan – Food
  "yoshinoya": "yoshinoya.com", "matsuya": "matsuyafoods.co.jp",
  "sukiya": "sukiya.jp", "sushiro": "akindo-sushiro.co.jp",
  "kura sushi": "kurasushi.jp", "hama sushi": "hamasushi.co.jp",
  "coco ichibanya": "ichibanya.co.jp", "gusto": "skylark.co.jp",
  "joyfull": "joyfull.co.jp", "denny's japan": "dennys.co.jp",
  "mos burger": "mos.co.jp", "freshness burger": "freshnessburger.co.jp",
  "lotteria": "lotteria.jp", "kentucky": "kfc.co.jp", "kfc": "kfc.co.jp",
  "dominos japan": "dominos.jp", "pizza la": "pizza-la.co.jp",
  "uber eats": "ubereats.com",
  // Japan – Streaming
  "abema": "abema.tv", "u-next": "video.unext.jp", "unext": "video.unext.jp",
  "dazn": "dazn.com", "nhk": "nhk.or.jp", "fuji tv": "fujitv.co.jp",
  "tver": "tver.jp", "niconico": "nicovideo.jp", "dmm": "dmm.com",
  // Japan – Telecom
  "docomo": "docomo.ne.jp", "softbank": "softbank.jp", "au": "au.com",
  "rakuten mobile": "network.mobile.rakuten.co.jp",
  // Japan – Finance
  "paypay": "paypay.ne.jp", "line pay": "linepay.line.me", "d payment": "d-card.jp",
  "jcb": "jcb.co.jp", "smbc": "smbc.co.jp", "mufg": "bk.mufg.jp",
  "mizuho": "mizuhobank.co.jp",
  // Japan – Transport / Travel
  "jr": "jr-central.co.jp", "ana": "ana.co.jp", "jal": "jal.co.jp",
  "suica": "jreast.co.jp", "pasmo": "pasmo.co.jp",
  "jtb": "jtb.co.jp", "jalan": "jalan.net", "ikyu": "ikyu.com",
  // Japan – Tech
  "line": "line.me", "cyberagent": "cyberagent.co.jp", "recruit": "recruit.co.jp",
  "freee": "freee.co.jp", "money forward": "moneyforward.com",
  // Global – Social / Communication
  "youtube": "youtube.com", "twitter": "twitter.com", "x.com": "x.com",
  "instagram": "instagram.com", "facebook": "facebook.com", "tiktok": "tiktok.com",
  "linkedin": "linkedin.com", "pinterest": "pinterest.com", "reddit": "reddit.com",
  "discord": "discord.com", "telegram": "telegram.org", "whatsapp": "whatsapp.com",
  "snapchat": "snapchat.com", "skype": "skype.com", "teams": "microsoft.com",
  // Global – Productivity / Cloud
  "google workspace": "google.com", "google drive": "google.com",
  "icloud": "apple.com", "onedrive": "microsoft.com",
  "aws": "aws.amazon.com", "azure": "azure.microsoft.com", "gcp": "cloud.google.com",
  // Global – Education
  "coursera": "coursera.org", "udemy": "udemy.com", "skillshare": "skillshare.com",
  "masterclass": "masterclass.com", "khan academy": "khanacademy.org",
  "chegg": "chegg.com", "quizlet": "quizlet.com",
  // Global – News / Media
  "new york times": "nytimes.com", "nytimes": "nytimes.com",
  "washington post": "washingtonpost.com", "wall street journal": "wsj.com",
  "economist": "economist.com", "bloomberg": "bloomberg.com",
  "nikkei": "nikkei.com", "asahi": "asahi.com",
  // Global – Gaming / Entertainment
  "playstore": "play.google.com", "app store": "apple.com",
  "amazon music": "music.amazon.com",
};

function guessDomain(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, domain] of Object.entries(MERCHANT_DOMAIN_MAP)) {
    if (lower.includes(key)) return domain;
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
  const logoUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;
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
      fontSize: 13, fontWeight: 800, color, flexShrink: 0,
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
      <span>{initials}</span>
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
