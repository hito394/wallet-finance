import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import { fetchEntities, fetchInsights, fetchMonthlyOverview } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string; year?: string; month?: string }>;
};

export default async function AnalyticsPage({ searchParams }: Props) {
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

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Raw analytics endpoint output for debugging and model iteration workflows."
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {overviewResult.error && <StatusMessage tone="error" title="Overview endpoint error" detail={overviewResult.error} />}
      {insightsResult.error && <StatusMessage tone="error" title="Insights endpoint error" detail={insightsResult.error} />}

      <section className="two-col">
        <div className="panel json-panel">
          <h3>Monthly Overview JSON</h3>
          <pre>{JSON.stringify(overviewResult.data, null, 2)}</pre>
        </div>
        <div className="panel json-panel">
          <h3>Insights JSON</h3>
          <pre>{JSON.stringify(insightsResult.data, null, 2)}</pre>
        </div>
      </section>
    </div>
  );
}
