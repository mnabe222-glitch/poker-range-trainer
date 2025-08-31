// src/components/ScenarioTabsWrap.tsx
export function ScenarioTabsWrap({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onChange(it.id)}
          className={
            "px-3 py-2 rounded-xl border text-sm " +
            (it.id === value
              ? "border-gray-900 font-semibold"
              : "border-gray-300")
          }
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
