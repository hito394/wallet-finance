type Props = { status: string };

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  parsed:       { label: "Parsed",       bg: "#dcfce7", fg: "#15803d" },
  ok:           { label: "Parsed OK",    bg: "#dcfce7", fg: "#15803d" },
  needs_review: { label: "Needs Review", bg: "#fef9c3", fg: "#a16207" },
  partial:      { label: "Partial",      bg: "#fef9c3", fg: "#a16207" },
  failed:       { label: "Failed",       bg: "#fee2e2", fg: "#b91c1c" },
  pending:      { label: "Pending",      bg: "#f1f5f9", fg: "#64748b" },
};

export default function DocumentStatusBadge({ status }: Props) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        background: meta.bg,
        color: meta.fg,
        border: `1px solid ${meta.fg}33`,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}
