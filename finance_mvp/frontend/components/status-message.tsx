type Props = {
  tone: "error" | "warn" | "info" | "success";
  title: string;
  detail?: string;
};

export default function StatusMessage({ tone, title, detail }: Props) {
  return (
    <div className={`status-message ${tone}`} role="status" aria-live="polite">
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}
