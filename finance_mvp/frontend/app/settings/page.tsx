import EntitySwitcher from "@/components/entity-switcher";
import PageHeader from "@/components/page-header";
import StatusMessage from "@/components/status-message";
import { fetchEntities, getApiBaseUrl } from "@/lib/api";

type Props = {
  searchParams?: Promise<{ entityId?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const params = (await searchParams) || {};
  const entitiesResult = await fetchEntities();
  const entities = entitiesResult.data || [];
  const selectedEntityId = params.entityId || entities[0]?.id;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Environment and app preferences for this deployment."
        actions={[{ href: "/dashboard", label: "Back to Dashboard" }]}
      />

      <section style={{ marginBottom: 14 }}>
        <EntitySwitcher entities={entities} selectedId={selectedEntityId || ""} />
      </section>

      {entitiesResult.error && (
        <StatusMessage tone="error" title="Unable to load entities" detail={entitiesResult.error} />
      )}

      <section className="panel settings-grid">
        <div>
          <h3>Runtime</h3>
          <p className="muted">Current API base URL</p>
          <code>{getApiBaseUrl()}</code>
        </div>

        <div>
          <h3>Preferences</h3>
          <ul className="settings-list">
            <li>
              <label>
                <input type="checkbox" defaultChecked />
                Enable dashboard alerts
              </label>
            </li>
            <li>
              <label>
                <input type="checkbox" defaultChecked />
                Highlight review-required documents
              </label>
            </li>
            <li>
              <label>
                <input type="checkbox" />
                Experimental chat memory (coming soon)
              </label>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
