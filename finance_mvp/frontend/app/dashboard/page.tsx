import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import MonthlyBarChart from "@/components/charts/MonthlyBarChart";
import SpendingPieChart from "@/components/charts/SpendingPieChart";
import SummaryCards from "@/components/dashboard/SummaryCards";
import RecentTransactionsList from "@/components/dashboard/RecentTransactionsList";
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

export default async function DashboardPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [overviewResult, transactionsResult, documentsResult, reviewResult, historyResult] = selectedEntityId
    ? await Promise.all([
        fetchMonthlyOverview(selectedEntityId, year, month),
        fetchTransactions(selectedEntityId, year, month),
        fetchDocuments(selectedEntityId),
        fetchReviewQueue(selectedEntityId),
        fetchMonthlyHistory(selectedEntityId, 6),
      ])
    : [
        { data: null, error: "No entity available", status: null },
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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader
        title="Dashboard"
        description="Track monthly performance, document health, and finance review workload from one place."
        actions={[
          { href: `/transactions?entityId=${selectedEntityId || ""}`, label: "Transactions" },
          { href: `/documents?entityId=${selectedEntityId || ""}`, label: "Upload Doc" },
        ]}
      />

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}
      {!selectedEntityId && (
        <StatusMessage
          tone="warn"
          title="No entity found"
          detail="Create or assign an entity from Settings, then refresh the dashboard."
        />
      )}

      <section style={{ marginBottom: -6 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {/* KPI Cards */}
      <SummaryCards
        overview={overview}
        docsRequiringReview={docsRequiringReview}
        openReviewQueue={reviewQueue.filter((item) => item.status === "pending").length}
      />

      {/* Charts row */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <SpendingPieChart data={overview?.category_breakdown ?? []} />
        <MonthlyBarChart data={history} />
      </div>

      {/* Alerts */}
      {(overview?.alerts.length ?? 0) > 0 && (
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 10 }}>⚠️ AI Alerts</h3>
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            {(overview?.alerts ?? []).map((alert) => (
              <li key={alert} style={{ color: "#92400e", fontSize: 14 }}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent transactions */}
      <RecentTransactionsList rows={transactions} entityId={selectedEntityId} />

      {/* Error banners */}
      {overviewResult.error && <StatusMessage tone="error" title="Overview unavailable" detail={overviewResult.error} />}
      {transactionsResult.error && (
        <StatusMessage tone="error" title="Transactions unavailable" detail={transactionsResult.error} />
      )}
    </div>
  );
}
