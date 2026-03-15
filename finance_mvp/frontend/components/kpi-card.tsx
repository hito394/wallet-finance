type Props = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn";
};

export default function KpiCard({ label, value, tone = "default" }: Props) {
  const borderColor = tone === "accent" ? "#0f766e" : tone === "warn" ? "#b45309" : "#d7dee5";
  return (
    <div className="panel" style={{ padding: 16, border: `2px solid ${borderColor}` }}>
      <p style={{ margin: 0, color: "#5f7284", fontSize: 13 }}>{label}</p>
      <p style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 700 }}>{value}</p>
    </div>
  );
}
