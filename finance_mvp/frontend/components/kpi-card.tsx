type Props = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "warn";
};

export default function KpiCard({ label, value, tone = "default" }: Props) {
  return (
    <div className={`panel kpi-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
