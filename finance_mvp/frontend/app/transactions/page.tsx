import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import TransactionsTable from "@/components/transactions-table";
import { fetchEntities, fetchTransactions } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string; year?: string; month?: string }>;
};

export default async function TransactionsPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const year = params.year ? Number(params.year) : undefined;
  const month = params.month ? Number(params.month) : undefined;

  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  const transactionsResult = selectedEntityId
    ? await fetchTransactions(selectedEntityId, year, month)
    : { data: [], error: "No entity selected", status: null };

  const rows = transactionsResult.data || [];

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Search, filter, and inspect transaction records with real API-backed data."
        actions={[
          { href: `/reports?entityId=${selectedEntityId || ""}`, label: "Open Reports" },
          { href: `/documents?entityId=${selectedEntityId || ""}`, label: "Open Documents" },
        ]}
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
          Apply Date Filter
        </button>
      </form>

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}
      {transactionsResult.error && (
        <StatusMessage tone="error" title="Unable to load transactions" detail={transactionsResult.error} />
      )}

      <TransactionsTable rows={rows} />
    </div>
  );
}
