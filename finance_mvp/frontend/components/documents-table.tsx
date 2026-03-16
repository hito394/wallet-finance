import type { DocumentItem } from "@/lib/api";

import { asNumber } from "@/lib/api";

type Props = {
  rows: DocumentItem[];
};

export default function DocumentsTable({ rows }: Props) {
  if (rows.length === 0) {
    return <div className="empty-state">No documents have been uploaded yet.</div>;
  }

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Source</th>
              <th>Merchant</th>
              <th>Status</th>
              <th>Confidence</th>
              <th className="amount-col">Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.document_type}</td>
                <td>{row.source_name}</td>
                <td>{row.merchant_name || "-"}</td>
                <td>
                  <span className={`pill ${row.review_required ? "warn" : "success"}`}>
                    {row.review_required ? "Needs Review" : "Ready"}
                  </span>
                </td>
                <td>{Math.round((row.extraction_confidence || 0) * 100)}%</td>
                <td className="amount-col">
                  {row.total_amount ? `${row.currency} ${asNumber(row.total_amount).toFixed(2)}` : "-"}
                </td>
                <td>{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
