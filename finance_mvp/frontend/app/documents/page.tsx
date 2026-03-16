import Link from "next/link";

import DocumentsTable from "@/components/documents-table";
import DocumentsUploadForm from "@/components/documents-upload-form";
import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import { fetchDocuments, fetchEntities, fetchReviewQueue } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function DocumentsPage({ searchParams }: Props) {
  const params = (await searchParams) || {};

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [documentsResult, reviewQueueResult] = selectedEntityId
    ? await Promise.all([fetchDocuments(selectedEntityId), fetchReviewQueue(selectedEntityId)])
    : [
        { data: [], error: "No entity selected", status: null },
        { data: [], error: "No entity selected", status: null },
      ];

  const docs = documentsResult.data || [];
  const reviewQueue = reviewQueueResult.data || [];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Upload statements/receipts and review extraction quality, confidence, and matching status."
        actions={[{ href: `/review?entityId=${selectedEntityId || ""}`, label: "Open Review Queue" }]}
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      <section className="panel info-row">
        <p>
          <strong>{docs.filter((item) => item.review_required).length}</strong> documents require review.
        </p>
        <p>
          <strong>{reviewQueue.length}</strong> queue items are open.
        </p>
        <Link href={`/review?entityId=${selectedEntityId || ""}`} className="btn secondary">
          Resolve Queue Items
        </Link>
      </section>

      <DocumentsUploadForm entityId={selectedEntityId} />

      {entitiesResult.error && <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />}
      {documentsResult.error && (
        <StatusMessage tone="error" title="Unable to load documents" detail={documentsResult.error} />
      )}

      <DocumentsTable rows={docs} />
    </div>
  );
}
