import { Suspense } from "react";
import Link from "next/link";
import EntitySwitcher from "@/components/entity-switcher";
import MonthSelector from "@/components/MonthSelector";
import HomeWidgets from "@/components/HomeWidgets";
import StatusMessage from "@/components/status-message";
import {
  fetchDocuments,
  fetchEntities,
  fetchMonthlyHistory,
  fetchMonthlyOverview,
  fetchReviewQueue,
  fetchTransactions,
} from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string; year?: string; month?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = (await searchParams) || {};

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [overviewResult, transactionsResult, documentsResult, reviewResult, historyResult] =
    selectedEntityId
      ? await Promise.all([
          fetchMonthlyOverview(selectedEntityId, year, month),
          fetchTransactions(selectedEntityId, year, month),
          fetchDocuments(selectedEntityId),
          fetchReviewQueue(selectedEntityId),
          fetchMonthlyHistory(selectedEntityId, 12),
        ])
      : [
          { data: null, error: null, status: null },
          { data: [], error: null, status: null },
          { data: [], error: null, status: null },
          { data: [], error: null, status: null },
          { data: [], error: null, status: null },
        ];

  const overview = overviewResult.data;
  const transactions = transactionsResult.data || [];
  const documents = documentsResult.data || [];
  const reviewQueue = reviewResult.data || [];
  const history = historyResult.data || [];
  const docsRequiringReview = documents.filter((doc) => doc.review_required).length;

  const selectedMonthStr = `${year}-${String(month).padStart(2, "0")}`;

  const monthDisplayName = new Date(year, month - 1, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#10212f" }}>
            Finance Overview
          </h1>
          <p style={{ margin: "4px 0 0", color: "#5f7284", fontSize: 14 }}>
            {monthDisplayName} — cashflow, trends &amp; spending breakdown
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href={`/documents${selectedEntityId ? `?entityId=${selectedEntityId}` : ""}`}
            className="btn secondary"
            style={{ fontSize: 13, padding: "7px 14px" }}
          >
            Upload Doc
          </Link>
          <Link
            href={`/transactions${selectedEntityId ? `?entityId=${selectedEntityId}` : ""}`}
            className="btn secondary"
            style={{ fontSize: 13, padding: "7px 14px" }}
          >
            Transactions
          </Link>
        </div>
      </div>

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}
      {!selectedEntityId && (
        <StatusMessage
          tone="warn"
          title="No entity found"
          detail="Create or assign an entity from Settings, then refresh."
        />
      )}

      {/* Entity switcher */}
      {entities.length > 0 && (
        <Suspense fallback={null}>
          <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
        </Suspense>
      )}

      {/* Month selector */}
      <div className="panel" style={{ padding: "14px 20px" }}>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: "#5f7284",
          }}
        >
          Select Month
        </p>
        <Suspense fallback={null}>
          <MonthSelector
            selectedYear={year}
            selectedMonth={month}
            entityId={selectedEntityId}
          />
        </Suspense>
      </div>

      {/* Customizable widgets */}
      <HomeWidgets
        overview={overview}
        transactions={transactions}
        history={history}
        selectedMonth={selectedMonthStr}
        entityId={selectedEntityId}
        docsRequiringReview={docsRequiringReview}
        openReviewQueue={reviewQueue.filter((item) => item.status === "pending").length}
        alerts={overview?.alerts ?? []}
      />

      {overviewResult.error && (
        <StatusMessage tone="error" title="Overview unavailable" detail={overviewResult.error} />
      )}
      {transactionsResult.error && (
        <StatusMessage
          tone="error"
          title="Transactions unavailable"
          detail={transactionsResult.error}
        />
      )}
    </div>
  );
}
