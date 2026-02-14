const navItems = [
  { id: "home", label: "Home", icon: "⌂", active: true },
  { id: "global", label: "Global", icon: "◉" },
  { id: "task", label: "Task", icon: "☑", badge: true },
  { id: "stats", label: "Stats", icon: "▥" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`bottom-nav-item${item.active ? " is-active" : ""}`}
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
