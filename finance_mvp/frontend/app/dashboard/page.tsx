import CategoryChart from "@/components/category-chart";
import EntitySwitcher from "@/components/entity-switcher";
import KpiCard from "@/components/kpi-card";
import RecentTransactions from "@/components/recent-transactions";
import { fetchDocuments, fetchEntities, fetchMonthlyOverview, fetchReviewQueue, fetchTransactions } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const entities = await fetchEntities();
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [overview, transactions, documents, reviewQueue] = await Promise.all([
    fetchMonthlyOverview(selectedEntityId),
    fetchTransactions(selectedEntityId),
    fetchDocuments(selectedEntityId),
    fetchReviewQueue(selectedEntityId),
  ]);

  const docsRequiringReview = documents.filter((doc) => doc.review_required).length;

  return (
    <main>
      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KpiCard label="Total Monthly Spend" value={`${overview.total_spend}`} tone="warn" />
        <KpiCard label="Monthly Income" value={`${overview.income}`} tone="accent" />
        <KpiCard label="Net Cashflow" value={`${overview.net}`} />
        <KpiCard label="Detected Subscriptions" value={`${overview.detected_subscriptions.length}`} />
        <KpiCard label="Docs Requiring Review" value={`${docsRequiringReview}`} tone="warn" />
        <KpiCard label="Open Review Queue" value={`${reviewQueue.length}`} tone="default" />
      </section>

      <section style={{ marginTop: 18, display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
        <CategoryChart data={overview.category_breakdown} />
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>AI Alerts</h3>
          {overview.alerts.length === 0 && <p style={{ margin: 0, color: "#5f7284" }}>No alerts this month.</p>}
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {overview.alerts.map((alert) => (
              <li key={alert} style={{ marginBottom: 8 }}>{alert}</li>
            ))}
          </ul>
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <RecentTransactions rows={transactions} />
      </section>
    </main>
  );
}
