type Transaction = {
  id: string;
  transaction_date: string;
  merchant_normalized: string;
  amount: string;
  currency: string;
  description: string;
};

export default function RecentTransactions({ rows }: { rows: Transaction[] }) {
  if (!rows.length) {
    return <div className="empty-state">No recent transactions available yet.</div>;
  }

  return (
    <div className="panel table-panel">
      <h3>Recent Transactions</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Description</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((row) => (
              <tr key={row.id}>
                <td>{row.transaction_date}</td>
                <td>{row.merchant_normalized}</td>
                <td>{row.description}</td>
                <td className="amount-col">
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
