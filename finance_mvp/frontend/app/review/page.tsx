import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import ReviewQueueTable from "@/components/review-queue-table";
import StatusMessage from "@/components/status-message";
import { fetchEntities, fetchReviewQueue } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function ReviewPage({ searchParams }: Props) {
  const params = (await searchParams) || {};

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const reviewResult = selectedEntityId
    ? await fetchReviewQueue(selectedEntityId)
    : { data: [], error: "No entity selected", status: null };

  return (
    <div>
      <PageHeader
        title="Review Queue"
        description="Resolve low-confidence document and transaction matches."
        actions={[{ href: `/documents?entityId=${selectedEntityId || ""}`, label: "Back to Documents" }]}
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {entitiesResult.error && <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />}
      {reviewResult.error && <StatusMessage tone="error" title="Unable to load review queue" detail={reviewResult.error} />}

      <ReviewQueueTable initialRows={reviewResult.data || []} />
    </div>
  );
}
