import Link from "next/link";
import type { TransactionItem } from "@/lib/api";

type Props = {
  rows: TransactionItem[];
  entityId?: string;
};

export default function RecentTransactionsList({ rows, entityId }: Props) {
  const items = rows.slice(0, 10);
  const href = `/transactions${entityId ? `?entityId=${entityId}` : ""}`;

  return (
    <div className="panel table-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3>Recent Transactions</h3>
        <Link href={href} className="btn secondary" style={{ fontSize: 13, padding: "6px 12px" }}>
          View all →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">No transactions yet. Upload a bank statement to get started.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th className="amount-col">Amount</th>
                <th className="amount-col">Type</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isCredit = row.direction === "inflow";
                return (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap", color: "#5f7284" }}>{row.transaction_date}</td>
                    <td style={{ fontWeight: 600 }}>{row.merchant_normalized || row.merchant_raw}</td>
                    <td style={{ color: "#5f7284", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.description}
                    </td>
                    <td
                      className="amount-col"
                      style={{
                        fontWeight: 700,
                        color: isCredit ? "#065f46" : "#991b1b",
                      }}
                    >
                      {isCredit ? "+" : "-"}{row.currency} {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="amount-col">
                      <span
                        className="pill"
                        style={
                          isCredit
                            ? { borderColor: "#b7e6d4", color: "#065f46", background: "#ecfdf5" }
                            : { borderColor: "#fecaca", color: "#991b1b", background: "#fef2f2" }
                        }
                      >
                        {isCredit ? "Income" : "Debit"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
