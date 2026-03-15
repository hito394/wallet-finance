type Transaction = {
  id: string;
  transaction_date: string;
  merchant_normalized: string;
  amount: string;
  currency: string;
  description: string;
};

export default function RecentTransactions({ rows }: { rows: Transaction[] }) {
  return (
    <div className="panel" style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Recent Transactions</h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Date</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Merchant</th>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Description</th>
              <th style={{ textAlign: "right", padding: "8px 6px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => (
              <tr key={row.id} style={{ borderTop: "1px solid #e8edf2" }}>
                <td style={{ padding: "8px 6px" }}>{row.transaction_date}</td>
                <td style={{ padding: "8px 6px" }}>{row.merchant_normalized}</td>
                <td style={{ padding: "8px 6px" }}>{row.description}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>
                  {row.currency} {row.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
