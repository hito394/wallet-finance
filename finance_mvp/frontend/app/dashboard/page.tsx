import Link from "next/link";

import CategoryChart from "@/components/category-chart";
import EntitySwitcher from "@/components/entity-switcher";
import KpiCard from "@/components/kpi-card";
import PageHeader from "@/components/page-header";
import RecentTransactions from "@/components/recent-transactions";
import StatusMessage from "@/components/status-message";
import { asNumber, fetchDocuments, fetchEntities, fetchMonthlyOverview, fetchReviewQueue, fetchTransactions } from "@/lib/api";

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

  const [overviewResult, transactionsResult, documentsResult, reviewResult] = selectedEntityId
    ? await Promise.all([
        fetchMonthlyOverview(selectedEntityId, year, month),
        fetchTransactions(selectedEntityId, year, month),
        fetchDocuments(selectedEntityId),
        fetchReviewQueue(selectedEntityId),
      ])
    : [
        { data: null, error: "No entity available", status: null },
        { data: [], error: null, status: null },
        { data: [], error: null, status: null },
        { data: [], error: null, status: null },
      ];

  const overview = overviewResult.data;
  const transactions = transactionsResult.data || [];
  const documents = documentsResult.data || [];
  const reviewQueue = reviewResult.data || [];
  const docsRequiringReview = documents.filter((doc) => doc.review_required).length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Track monthly performance, document health, and finance review workload from one place."
        actions={[
          { href: "/transactions", label: "Open Transactions" },
          { href: "/documents", label: "Open Documents" },
          { href: "/reports", label: "View Reports" },
        ]}
      />

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {!selectedEntityId && (
        <StatusMessage
          tone="warn"
          title="No entity found"
          detail="Create or assign an entity from Settings, then refresh the dashboard."
        />
      )}

      {overviewResult.error && <StatusMessage tone="error" title="Overview unavailable" detail={overviewResult.error} />}
      {transactionsResult.error && (
        <StatusMessage tone="error" title="Transactions unavailable" detail={transactionsResult.error} />
      )}
      {documentsResult.error && <StatusMessage tone="error" title="Documents unavailable" detail={documentsResult.error} />}

      <section className="quick-links panel">
        <Link href={`/transactions?entityId=${selectedEntityId || ""}`}>Transactions</Link>
        <Link href={`/documents?entityId=${selectedEntityId || ""}`}>Documents</Link>
        <Link href={`/reports?entityId=${selectedEntityId || ""}`}>Reports</Link>
        <Link href={`/chatbot?entityId=${selectedEntityId || ""}`}>Chatbot</Link>
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard label="Total Monthly Spend" value={`${overview?.total_spend ?? "0"}`} tone="warn" />
        <KpiCard label="Monthly Income" value={`${overview?.income ?? "0"}`} tone="accent" />
        <KpiCard label="Net Cashflow" value={`${overview?.net ?? "0"}`} tone="default" />
        <KpiCard label="Detected Subscriptions" value={`${overview?.detected_subscriptions.length ?? 0}`} />
        <KpiCard label="Docs Requiring Review" value={`${docsRequiringReview}`} tone="warn" />
        <KpiCard label="Open Review Queue" value={`${reviewQueue.length}`} tone="default" />
      </section>

      <section style={{ marginTop: 18, display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
        <CategoryChart data={overview?.category_breakdown ?? []} />
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>AI Alerts</h3>
          {(overview?.alerts.length ?? 0) === 0 && <p style={{ margin: 0, color: "#5f7284" }}>No alerts this month.</p>}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(overview?.alerts ?? []).map((alert) => (
              <li key={alert} style={{ marginBottom: 8 }}>{alert}</li>
            ))}
          </ul>

          <div style={{ marginTop: 14 }}>
            <p style={{ margin: 0, color: "#5f7284", fontSize: 13 }}>Net cashflow this month</p>
            <strong style={{ fontSize: 22 }}>${asNumber(overview?.net).toLocaleString()}</strong>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <RecentTransactions rows={transactions} />
      </section>
    </div>
  );
}
