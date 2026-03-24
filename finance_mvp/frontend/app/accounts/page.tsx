import PageHeader from "@/components/page-header";
import { fetchEntities } from "@/lib/api";
import PlaidConnect from "@/components/PlaidConnect";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function AccountsPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  return (
    <div>
      <PageHeader
        title="口座管理"
        description="銀行口座・クレジットカードを接続して取引を自動インポート"
        actions={[{ href: "/", label: "← Dashboard" }]}
      />
      <PlaidConnect entityId={selectedEntityId} />
    </div>
  );
}
