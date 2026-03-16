import type { MonthlyOverview } from "@/lib/api";
import { asNumber } from "@/lib/api";

type Props = {
  overview: MonthlyOverview | null;
  docsRequiringReview: number;
  openReviewQueue: number;
};

type CardProps = {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  variant: "green" | "red" | "blue" | "amber" | "neutral";
};

const VARIANTS: Record<CardProps["variant"], { bg: string; iconBg: string; valueColor: string }> = {
  green:   { bg: "linear-gradient(140deg,#ecfdf5 0%,#f8fffd 100%)", iconBg: "#bbf7d0", valueColor: "#065f46" },
  red:     { bg: "linear-gradient(140deg,#fef2f2 0%,#fff 100%)",    iconBg: "#fecaca", valueColor: "#991b1b" },
  blue:    { bg: "linear-gradient(140deg,#eff6ff 0%,#fff 100%)",    iconBg: "#bfdbfe", valueColor: "#1e40af" },
  amber:   { bg: "linear-gradient(140deg,#fffbeb 0%,#fff 100%)",    iconBg: "#fde68a", valueColor: "#92400e" },
  neutral: { bg: "#fff",                                             iconBg: "#e8eef3", valueColor: "#10212f" },
};

function SummaryCard({ label, value, sub, icon, variant }: CardProps) {
  const s = VARIANTS[variant];
  return (
    <div
      className="panel"
      style={{
        padding: "18px 20px",
        background: s.bg,
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: s.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#5f7284", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
          {label}
        </p>
        <strong style={{ display: "block", fontSize: 26, fontWeight: 800, color: s.valueColor, lineHeight: 1.1, marginTop: 4 }}>
          {value}
        </strong>
        {sub && <p style={{ color: "#5f7284", fontSize: 12, marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function SummaryCards({ overview, docsRequiringReview, openReviewQueue }: Props) {
  const spend  = asNumber(overview?.total_spend);
  const income = asNumber(overview?.income);
  const net    = asNumber(overview?.net);
  const subs   = overview?.detected_subscriptions.length ?? 0;

  const fmt = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;

  const cards: CardProps[] = [
    {
      label: "Monthly Spend",
      value: fmt(spend),
      sub: overview?.month ?? "—",
      icon: "💸",
      variant: "red",
    },
    {
      label: "Monthly Income",
      value: fmt(income),
      sub: overview?.month ?? "—",
      icon: "💰",
      variant: "green",
    },
    {
      label: "Net Cashflow",
      value: (net >= 0 ? "+" : "") + fmt(net),
      sub: net >= 0 ? "Positive" : "Negative",
      icon: net >= 0 ? "📈" : "📉",
      variant: net >= 0 ? "green" : "red",
    },
    {
      label: "Subscriptions",
      value: String(subs),
      sub: subs > 0 ? "Recurring detected" : "None detected",
      icon: "🔄",
      variant: "blue",
    },
    {
      label: "Docs for Review",
      value: String(docsRequiringReview),
      sub: docsRequiringReview > 0 ? "Action needed" : "All clear",
      icon: "📄",
      variant: docsRequiringReview > 0 ? "amber" : "neutral",
    },
    {
      label: "Review Queue",
      value: String(openReviewQueue),
      sub: openReviewQueue > 0 ? "Items open" : "Queue empty",
      icon: "✅",
      variant: openReviewQueue > 0 ? "amber" : "neutral",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      }}
    >
      {cards.map((c) => (
        <SummaryCard key={c.label} {...c} />
      ))}
    </div>
  );
}
