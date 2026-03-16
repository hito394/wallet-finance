const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  bank_statement:              { label: "Bank Statement",      color: "#2563eb" },
  credit_card_statement:       { label: "Credit Card Stmt",    color: "#7c3aed" },
  receipt:                     { label: "Receipt",             color: "#059669" },
  invoice:                     { label: "Invoice",             color: "#d97706" },
  paid_invoice:                { label: "Paid Invoice",        color: "#10b981" },
  refund_confirmation:         { label: "Refund",              color: "#06b6d4" },
  subscription_charge:         { label: "Subscription",        color: "#8b5cf6" },
  order_confirmation:          { label: "Order Confirm",       color: "#0ea5e9" },
  tax_supporting_document:     { label: "Tax Doc",             color: "#f59e0b" },
  transaction_screenshot:      { label: "Screenshot",          color: "#64748b" },
  digital_purchase_confirmation:{ label: "Digital Purchase",   color: "#6366f1" },
  reimbursement_document:      { label: "Reimbursement",       color: "#ec4899" },
  unknown_financial_document:  { label: "Unknown",             color: "#94a3b8" },
};

type Props = { docType: string };

export default function DocumentTypeBadge({ docType }: Props) {
  const meta = TYPE_LABELS[docType] ?? { label: docType, color: "#94a3b8" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: meta.color + "22",
        color: meta.color,
        border: `1px solid ${meta.color}44`,
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}
