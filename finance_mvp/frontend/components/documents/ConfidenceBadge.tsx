type Props = { confidence: number };

export default function ConfidenceBadge({ confidence }: Props) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 70 ? "#16a34a" : pct >= 45 ? "#d97706" : "#dc2626";
  const bg   = pct >= 70 ? "#dcfce7" : pct >= 45 ? "#fef3c7" : "#fee2e2";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
        border: `1px solid ${color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {pct}%
    </span>
  );
}
