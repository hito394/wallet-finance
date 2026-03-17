"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  selectedYear: number;
  selectedMonth: number;
  entityId?: string;
};

function buildMonthList(count: number) {
  const now = new Date();
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString("en", { month: "short" }),
      yearLabel: "'" + String(d.getFullYear()).slice(2),
      isCurrent: i === 0,
    });
  }
  return result;
}

export default function MonthSelector({ selectedYear, selectedMonth, entityId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const months = buildMonthList(12);

  const navigate = (year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("month", String(month));
    if (entityId) params.set("entityId", entityId);
    else params.delete("entityId");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {months.map(({ year, month, label, yearLabel, isCurrent }) => {
        const isSelected = year === selectedYear && month === selectedMonth;
        return (
          <button
            key={`${year}-${month}`}
            onClick={() => navigate(year, month)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "8px 14px",
              borderRadius: 12,
              border: "1.5px solid",
              borderColor: isSelected ? "#0f766e" : "#d4dee6",
              background: isSelected
                ? "linear-gradient(135deg,#0f766e,#14b8a6)"
                : isCurrent
                ? "#f0fdf9"
                : "#fff",
              color: isSelected ? "#fff" : isCurrent ? "#0f766e" : "#5f7284",
              fontWeight: isSelected ? 700 : 500,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              lineHeight: 1.2,
              boxShadow: isSelected ? "0 2px 8px rgba(15,118,110,0.25)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ fontWeight: isSelected ? 800 : 600, fontSize: 14 }}>{label}</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>{yearLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
