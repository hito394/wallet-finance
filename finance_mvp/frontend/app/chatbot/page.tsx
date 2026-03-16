import ChatPanel from "@/components/chat-panel";
import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import { fetchEntities } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function ChatbotPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  return (
    <div>
      <PageHeader
        title="Chatbot"
        description="Ask natural-language questions about spend patterns, anomalies, and next actions."
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}

      <StatusMessage
        tone="info"
        title="Chat endpoint readiness"
        detail="If the backend chat endpoint is unavailable, the UI still returns a graceful fallback response."
      />

      <ChatPanel entityId={selectedEntityId} />
    </div>
  );
}
