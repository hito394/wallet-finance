"use client";

import { useState } from "react";

import { downloadAccountingCsv } from "@/lib/api";
import StatusMessage from "@/components/status-message";

type Props = {
  entityId?: string;
};

export default function ExportCsvButton({ entityId }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        className="btn secondary"
        disabled={isLoading}
        onClick={async () => {
          setIsLoading(true);
          setError(null);
          const result = await downloadAccountingCsv(entityId);
          setIsLoading(false);

          if (result.error || !result.data) {
            setError(result.error || "Unable to export CSV.");
            return;
          }

          const url = URL.createObjectURL(result.data);
          const link = document.createElement("a");
          link.href = url;
          link.download = "accounting_export.csv";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        {isLoading ? "Exporting..." : "Export Accounting CSV"}
      </button>

      {error && <StatusMessage tone="error" title="CSV export failed" detail={error} />}
    </div>
  );
}
