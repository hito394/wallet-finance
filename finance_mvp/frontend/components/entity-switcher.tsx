"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type EntityItem = {
  id: string;
  name: string;
  entity_type: "personal" | "freelancer" | "business" | "organization";
};

export default function EntitySwitcher({ entities, selectedId }: { entities: EntityItem[]; selectedId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="panel" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
      <strong style={{ fontSize: 14 }}>Entity</strong>
      <select
        value={selectedId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("entityId", event.target.value);
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        style={{
          border: "1px solid #d7dee5",
          borderRadius: 8,
          padding: "8px 10px",
          background: "white",
          minWidth: 220,
        }}
      >
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name} ({entity.entity_type})
          </option>
        ))}
      </select>
    </div>
  );
}
