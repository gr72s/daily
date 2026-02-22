import type { StandardSection } from "../types/todo";

const navItems: Array<{ id: StandardSection; label: string; icon: string; badge?: boolean }> = [
  { id: "home", label: "Home", icon: "H" },
  { id: "global", label: "Global", icon: "G" },
  { id: "task", label: "Task", icon: "T", badge: true },
  { id: "tag", label: "Tag", icon: "#" },
  { id: "stats", label: "Stats", icon: "S" },
];

interface BottomNavProps {
  active: StandardSection;
  onChange: (section: StandardSection) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`bottom-nav-item${active === item.id ? " is-active" : ""}`}
          onClick={() => onChange(item.id)}
          type="button"
          aria-label={item.label}
        >
          <span className="bottom-nav-icon-wrap">
            <span className="bottom-nav-icon">{item.icon}</span>
            {item.badge ? <span className="bottom-nav-badge" /> : null}
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}