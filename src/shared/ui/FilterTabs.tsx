import type { TaskFilter } from "../types/todo";

const filters: Array<{ key: TaskFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

interface FilterTabsProps {
  value: TaskFilter;
  onChange: (filter: TaskFilter) => void;
}

export function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <div className="filter-tabs" role="tablist" aria-label="Task filter">
      {filters.map((filter) => {
        const active = filter.key === value;
        return (
          <button
            key={filter.key}
            className={`filter-tab${active ? " is-active" : ""}`}
            onClick={() => onChange(filter.key)}
            role="tab"
            aria-selected={active}
            type="button"
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
