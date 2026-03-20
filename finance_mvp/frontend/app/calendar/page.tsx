import { Suspense } from "react";
import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import SpendingCalendar from "@/components/SpendingCalendar";
import {
  fetchEntities,
  fetchTransactions,
  fetchTransactionCategories,
} from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string; year?: string; month?: string }>;
};

export default async function CalendarPage({ searchParams }: Props) {
  const params = (await searchParams) || {};

  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const [transactionsResult, categoriesResult] = selectedEntityId
    ? await Promise.all([
        fetchTransactions(selectedEntityId, year, month),
        fetchTransactionCategories(selectedEntityId),
      ])
    : [
        { data: [], error: null, status: null },
        { data: [], error: null, status: null },
      ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <PageHeader
        title="Calendar"
        description="See daily spending and what each day's transactions look like."
      />

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

      {entities.length > 0 && (
        <Suspense fallback={null}>
          <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
        </Suspense>
      )}

      {selectedEntityId && (
        <SpendingCalendar
          key={selectedEntityId}
          initialTransactions={transactionsResult.data || []}
          categories={categoriesResult.data || []}
          initialYear={year}
          initialMonth={month}
          entityId={selectedEntityId}
        />
      )}
    </div>
  );
}
