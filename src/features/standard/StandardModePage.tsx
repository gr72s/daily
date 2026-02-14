import { FormEvent, useMemo, useState } from "react";
import { getWidgetOpacity, setWidgetOpacity as persistWidgetOpacity } from "../../shared/settings/widget";
import { getVisibleTasks, useTodoStore } from "../../shared/state/useTodoStore";
import { ensureWidgetWindow } from "../../shared/tauri/window";
import { BottomNav } from "../../shared/ui/BottomNav";
import { FilterTabs } from "../../shared/ui/FilterTabs";
import { TaskRow } from "../../shared/ui/TaskRow";

const sidebarItems = [
  { id: "home", label: "Home", icon: "⌂", active: true },
  { id: "global", label: "Global", icon: "◎" },
  { id: "task", label: "Task", icon: "☑" },
  { id: "stats", label: "Stats", icon: "▤" },
];

export function StandardModePage() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [windowError, setWindowError] = useState<string | null>(null);
  const [widgetOpacity, setWidgetOpacity] = useState(() => getWidgetOpacity());

  const filter = useTodoStore((state) => state.filter);
  const sortMode = useTodoStore((state) => state.sortMode);
  const setFilter = useTodoStore((state) => state.setFilter);
  const setSortMode = useTodoStore((state) => state.setSortMode);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const addTask = useTodoStore((state) => state.addTask);

  const tasks = useTodoStore((state) => state.tasks);
  const visibleTasks = useMemo(() => getVisibleTasks(tasks, filter, sortMode), [tasks, filter, sortMode]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    addTask(newTaskTitle);
    setNewTaskTitle("");
  };

  const onOpenWidget = async () => {
    try {
      setWindowError(null);
      await ensureWidgetWindow();
    } catch (error) {
      setWindowError(error instanceof Error ? error.message : "Unable to open widget window.");
    }
  };

  const onWidgetOpacityChange = (value: number) => {
    setWidgetOpacity(value);
    persistWidgetOpacity(value);
  };

  return (
    <div className="standard-shell">
      <aside className="standard-sidebar" aria-label="Sidebar navigation">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">✓</span>
          <span className="sidebar-brand-text">TauriDo</span>
        </div>

        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button key={item.id} className={`sidebar-nav-item${item.active ? " is-active" : ""}`} type="button">
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <label className="sidebar-opacity-label" htmlFor="sidebar-opacity-slider">
            Opacity
          </label>
          <input
            id="sidebar-opacity-slider"
            className="sidebar-opacity-slider"
            type="range"
            min={0}
            max={100}
            value={widgetOpacity}
            onChange={(event) => onWidgetOpacityChange(Number(event.currentTarget.value))}
          />
          <button className="sidebar-widget-button" onClick={onOpenWidget} type="button">
            Open Widget
          </button>
        </div>
      </aside>

      <div className="standard-page">
        <main className="standard-main">
          <header className="standard-header">
            <h1 className="standard-title">Home</h1>
            <button className="icon-button" onClick={onOpenWidget} type="button" aria-label="Open widget mode">
              ⚙
            </button>
          </header>

          <section className="standard-filters" aria-label="Task controls">
            <FilterTabs value={filter} onChange={setFilter} />
            <button
              className="sort-pill"
              onClick={() => setSortMode(sortMode === "status" ? "priority" : "status")}
              type="button"
            >
              Sort: {sortMode === "status" ? "Status" : "Priority"}
            </button>
          </section>

          <form className="task-input" onSubmit={onSubmit}>
            <span className="task-input-plus">＋</span>
            <input
              className="task-input-field"
              onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
              placeholder="Add a new task..."
              value={newTaskTitle}
            />
          </form>

          {windowError ? <p className="standard-error">{windowError}</p> : null}

          <section className="task-list" aria-label="Task list">
            {visibleTasks.length > 0 ? (
              visibleTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={toggleTask} />)
            ) : (
              <div className="task-empty">No tasks yet. Add one above.</div>
            )}
          </section>

          <button className="fab" onClick={onOpenWidget} type="button" aria-label="Open widget">
            +
          </button>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
