import CategoryChart from "@/components/category-chart";
import EntitySwitcher from "@/components/entity-switcher";
import ExportCsvButton from "@/components/export-csv-button";
import KpiCard from "@/components/kpi-card";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import { asNumber, fetchEntities, fetchInsights, fetchMonthlyOverview } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string; year?: string; month?: string }>;
};

export default async function ReportsPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [overviewResult, insightsResult] = selectedEntityId
    ? await Promise.all([fetchMonthlyOverview(selectedEntityId, year, month), fetchInsights(selectedEntityId, year, month)])
    : [
        { data: null, error: "No entity selected", status: null },
        { data: [], error: "No entity selected", status: null },
      ];

  const overview = overviewResult.data;
  const insights = insightsResult.data || [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Analyze monthly totals, category distribution, and AI-generated finance insights."
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      <form className="panel form-inline" method="get">
        <input type="hidden" name="entityId" value={selectedEntityId || ""} />
        <label>
          Year
          <input className="input" name="year" type="number" min={2000} max={2100} defaultValue={params.year || ""} />
        </label>
        <label>
          Month
          <input className="input" name="month" type="number" min={1} max={12} defaultValue={params.month || ""} />
        </label>
        <button className="btn secondary" type="submit">
          Update Report
        </button>
        <ExportCsvButton entityId={selectedEntityId} />
      </form>

      {entitiesResult.error && <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />}
      {overviewResult.error && <StatusMessage tone="error" title="Unable to load overview" detail={overviewResult.error} />}
      {insightsResult.error && <StatusMessage tone="error" title="Unable to load insights" detail={insightsResult.error} />}

      <section className="kpi-grid">
        <KpiCard label="Total Spend" value={`${overview?.total_spend ?? "0"}`} tone="warn" />
        <KpiCard label="Income" value={`${overview?.income ?? "0"}`} tone="accent" />
        <KpiCard label="Net" value={`${overview?.net ?? "0"}`} tone="default" />
      </section>

      <section className="two-col" style={{ marginTop: 16 }}>
        <CategoryChart data={overview?.category_breakdown || []} />
        <div className="panel insights-panel">
          <h3>AI Insights</h3>
          {!insights.length ? (
            <div className="empty-state">No insights generated for this period.</div>
          ) : (
            <ul>
              {insights.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <span className={`pill ${item.severity === "critical" ? "warn" : "default"}`}>{item.severity}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="summary-block">
            <p>
              Subscription flags: <strong>{overview?.detected_subscriptions.length ?? 0}</strong>
            </p>
            <p>
              Net numeric: <strong>{asNumber(overview?.net).toLocaleString()}</strong>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
