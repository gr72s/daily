import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getWidgetHoverOpacity,
  getWidgetOpacity,
  getWidgetScale,
  setWidgetHoverOpacity as persistWidgetHoverOpacity,
  setWidgetOpacity as persistWidgetOpacity,
  setWidgetScale as persistWidgetScale,
} from "../../shared/settings/widget";
import { getVisibleTasks, useTodoStore } from "../../shared/state/useTodoStore";
import {
  emitWidgetSetLock,
  getCurrentWindowLabelSafe,
  onWidgetAlignmentUpdated,
  onWidgetSetVisibility,
  onTaskStatusUpdated,
  onTasksStateUpdated,
  onWidgetTaskViewUpdated,
  onWidgetSetLock,
  syncWidgetLockedState,
  syncWidgetVisibilityState,
  setWidgetWindowVisibility,
} from "../../shared/tauri/window";
import type { StandardSection } from "../../shared/types/todo";
import { BottomNav } from "../../shared/ui/BottomNav";
import { FilterTabs } from "../../shared/ui/FilterTabs";
import { TaskRow } from "../../shared/ui/TaskRow";
import { GlobalPanel } from "./GlobalPanel";
import { TaskPanel } from "./TaskPanel";

const sidebarItems: Array<{ id: StandardSection; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "global", label: "Global", icon: "🌐" },
  { id: "task", label: "Task", icon: "✅" },
  { id: "stats", label: "Stats", icon: "📊" },
];

const sectionTitle: Record<StandardSection, string> = {
  home: "Home",
  global: "Global",
  task: "Task",
  stats: "Stats",
};

function ComingSoonSection({ section }: { section: StandardSection }) {
  return (
    <section className="coming-soon">
      <h2>{sectionTitle[section]} Page</h2>
      <p>This section is reserved in design and will be implemented next.</p>
    </section>
  );
}

export function StandardModePage() {
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [modalTaskTitle, setModalTaskTitle] = useState("");
  const [windowError, setWindowError] = useState<string | null>(null);
  const [widgetOpacity, setWidgetOpacity] = useState(() => getWidgetOpacity());
  const [widgetHoverOpacity, setWidgetHoverOpacity] = useState(() => getWidgetHoverOpacity());
  const [widgetScale, setWidgetScale] = useState(() => getWidgetScale());
  const [activeSection, setActiveSection] = useState<StandardSection>("home");
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  const filter = useTodoStore((state) => state.filter);
  const sortMode = useTodoStore((state) => state.sortMode);
  const setFilter = useTodoStore((state) => state.setFilter);
  const setSortMode = useTodoStore((state) => state.setSortMode);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const applySyncedTaskStatus = useTodoStore((state) => state.applySyncedTaskStatus);
  const applySyncedTasksState = useTodoStore((state) => state.applySyncedTasksState);
  const applySyncedWidgetTaskView = useTodoStore((state) => state.applySyncedWidgetTaskView);
  const applySyncedWidgetAlignment = useTodoStore((state) => state.applySyncedWidgetAlignment);
  const addTask = useTodoStore((state) => state.addTask);
  const widgetLocked = useTodoStore((state) => state.widgetLocked);
  const widgetVisible = useTodoStore((state) => state.widgetVisible);
  const widgetShowAllTasks = useTodoStore((state) => state.widgetShowAllTasks);
  const widgetAlignMode = useTodoStore((state) => state.widgetAlignMode);
  const setWidgetLocked = useTodoStore((state) => state.setWidgetLocked);
  const setWidgetVisible = useTodoStore((state) => state.setWidgetVisible);
  const setWidgetShowAllTasks = useTodoStore((state) => state.setWidgetShowAllTasks);
  const setWidgetAlignMode = useTodoStore((state) => state.setWidgetAlignMode);

  const tasks = useTodoStore((state) => state.tasks);
  const visibleTasks = useMemo(() => getVisibleTasks(tasks, filter, sortMode), [tasks, filter, sortMode]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    addTask(newTaskTitle);
    setNewTaskTitle("");
  };

  const openAddTaskModal = () => {
    setIsAddTaskModalOpen(true);
    setModalTaskTitle("");
  };

  const closeAddTaskModal = () => {
    setIsAddTaskModalOpen(false);
  };

  const onSubmitModalTask = (event: FormEvent) => {
    event.preventDefault();
    const normalizedTitle = modalTaskTitle.trim();
    if (!normalizedTitle) {
      return;
    }

    addTask(normalizedTitle);
    setModalTaskTitle("");
    closeAddTaskModal();
  };

  const onToggleWidgetVisibility = async () => {
    const nextVisible = !widgetVisible;
    try {
      setWindowError(null);
      await setWidgetWindowVisibility(nextVisible);
      setWidgetVisible(nextVisible);
      await syncWidgetVisibilityState(nextVisible);
    } catch (error) {
      setWindowError(error instanceof Error ? error.message : "Unable to update widget visibility.");
    }
  };

  const onToggleWidgetLock = () => {
    const nextLocked = !widgetLocked;
    setWidgetLocked(nextLocked);
    void syncWidgetLockedState(nextLocked);
    void emitWidgetSetLock(nextLocked);
  };

  const onToggleWidgetTaskView = () => {
    setWidgetShowAllTasks(!widgetShowAllTasks);
  };

  const onToggleWidgetAlignMode = () => {
    setWidgetAlignMode(widgetAlignMode === "right" ? "left" : "right");
  };

  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | undefined;
    void onWidgetSetLock((locked) => {
      setWidgetLocked(locked);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      isDisposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [setWidgetLocked]);

  useEffect(() => {
    if (!widgetVisible) {
      return;
    }

    void setWidgetWindowVisibility(true).catch(() => {
      setWindowError("Unable to restore widget window.");
    });
  }, [widgetVisible]);

  useEffect(() => {
    let isDisposed = false;
    let unlisten: (() => void) | undefined;
    void onWidgetSetVisibility((visible) => {
      setWidgetVisible(visible);
      void setWidgetWindowVisibility(visible).catch(() => {
        setWindowError("Unable to apply widget visibility from tray.");
      });
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      isDisposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [setWidgetVisible]);

  useEffect(() => {
    void syncWidgetLockedState(widgetLocked);
  }, [widgetLocked]);

  useEffect(() => {
    const currentLabel = getCurrentWindowLabelSafe();
    let isDisposed = false;
    let unlistenTaskStatus: (() => void) | undefined;
    let unlistenTaskState: (() => void) | undefined;
    let unlistenWidgetTaskView: (() => void) | undefined;
    let unlistenWidgetAlignment: (() => void) | undefined;
    void onTaskStatusUpdated((payload) => {
      if (payload.sourceWindowLabel && payload.sourceWindowLabel === currentLabel) {
        return;
      }
      applySyncedTaskStatus(payload);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenTaskStatus = dispose;
    });

    void onTasksStateUpdated((payload) => {
      if (payload.sourceWindowLabel && payload.sourceWindowLabel === currentLabel) {
        return;
      }
      applySyncedTasksState(payload);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenTaskState = dispose;
    });

    void onWidgetTaskViewUpdated((payload) => {
      if (payload.sourceWindowLabel && payload.sourceWindowLabel === currentLabel) {
        return;
      }
      applySyncedWidgetTaskView(payload);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenWidgetTaskView = dispose;
    });

    void onWidgetAlignmentUpdated((payload) => {
      if (payload.sourceWindowLabel && payload.sourceWindowLabel === currentLabel) {
        return;
      }
      applySyncedWidgetAlignment(payload);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenWidgetAlignment = dispose;
    });

    return () => {
      isDisposed = true;
      if (unlistenTaskStatus) {
        unlistenTaskStatus();
      }
      if (unlistenTaskState) {
        unlistenTaskState();
      }
      if (unlistenWidgetTaskView) {
        unlistenWidgetTaskView();
      }
      if (unlistenWidgetAlignment) {
        unlistenWidgetAlignment();
      }
    };
  }, [applySyncedTaskStatus, applySyncedTasksState, applySyncedWidgetTaskView, applySyncedWidgetAlignment]);

  const onWidgetOpacityChange = (value: number) => {
    setWidgetOpacity(value);
    persistWidgetOpacity(value);
  };

  const onWidgetHoverOpacityChange = (value: number) => {
    setWidgetHoverOpacity(value);
    persistWidgetHoverOpacity(value);
  };
  const onWidgetScaleChange = (value: number) => {
    setWidgetScale(value);
    persistWidgetScale(value);
  };
  const onResetWidgetScale = () => {
    setWidgetScale(100);
    persistWidgetScale(100);
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
            <button
              key={item.id}
              className={`sidebar-nav-item${item.id === activeSection ? " is-active" : ""}`}
              onClick={() => setActiveSection(item.id)}
              type="button"
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <label className="sidebar-opacity-label" htmlFor="sidebar-opacity-slider">
            {`Widget Background (${widgetOpacity}%)`}
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
          <label className="sidebar-opacity-label" htmlFor="sidebar-hover-opacity-slider">
            {`Hover Background (${widgetHoverOpacity}%)`}
          </label>
          <input
            id="sidebar-hover-opacity-slider"
            className="sidebar-opacity-slider"
            type="range"
            min={0}
            max={100}
            value={widgetHoverOpacity}
            onChange={(event) => onWidgetHoverOpacityChange(Number(event.currentTarget.value))}
          />
          <label className="sidebar-opacity-label" htmlFor="sidebar-scale-slider">
            {`Widget Scale (${widgetScale}%)`}
          </label>
          <input
            id="sidebar-scale-slider"
            className="sidebar-opacity-slider"
            type="range"
            min={70}
            max={300}
            value={widgetScale}
            onChange={(event) => onWidgetScaleChange(Number(event.currentTarget.value))}
          />
          <button className="sidebar-scale-reset-button" onClick={onResetWidgetScale} type="button">
            Reset Scale to 100%
          </button>
          <button className="sidebar-widget-button" onClick={onToggleWidgetVisibility} type="button">
            {widgetVisible ? "Hide Widget" : "Show Widget"}
          </button>
        </div>
      </aside>

      <div className="standard-page">
        <main className="standard-main">
          <header className="standard-header">
            <h1 className="standard-title">{sectionTitle[activeSection]}</h1>
            <div className="standard-header-actions">
              <button className={`widget-align-toggle ${widgetAlignMode === "right" ? "is-open" : "is-closed"}`} onClick={onToggleWidgetAlignMode} type="button">
                {widgetAlignMode === "right" ? "Widget: Right Align" : "Widget: Left Align"}
              </button>
              <button className={`widget-visibility-toggle ${widgetVisible ? "is-open" : "is-closed"}`} onClick={onToggleWidgetVisibility} type="button">
                {widgetVisible ? "Widget: Visible" : "Widget: Hidden"}
              </button>
              <button className={`widget-view-toggle ${widgetShowAllTasks ? "is-open" : "is-closed"}`} onClick={onToggleWidgetTaskView} type="button">
                {widgetShowAllTasks ? "Widget: All Tasks" : "Widget: Active Only"}
              </button>
              <button className={`widget-lock-toggle ${widgetLocked ? "is-open" : "is-closed"}`} onClick={onToggleWidgetLock} type="button">
                {widgetLocked ? "Unlock Widget" : "Lock Widget"}
              </button></div>
          </header>

          {activeSection === "home" ? (
            <>
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
                <button
                  className="task-input-plus"
                  onClick={openAddTaskModal}
                  type="button"
                  aria-label="Open add task dialog"
                >
                  锛?                </button>
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
            </>
          ) : null}

          {activeSection === "global" ? <GlobalPanel /> : null}
          {activeSection === "task" ? <TaskPanel /> : null}
          {activeSection === "stats" ? <ComingSoonSection section="stats" /> : null}

          <button className="fab" onClick={openAddTaskModal} type="button" aria-label="Add task">
            +
          </button>

          {isAddTaskModalOpen ? (
            <div className="task-modal-backdrop" onClick={closeAddTaskModal} role="presentation">
              <div
                className="task-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-label="Add task"
                aria-modal="true"
              >
                <h2 className="task-modal-title">Add a new task</h2>
                <form className="task-modal-form" onSubmit={onSubmitModalTask}>
                  <input
                    autoFocus
                    className="task-modal-input"
                    onChange={(event) => setModalTaskTitle(event.currentTarget.value)}
                    placeholder="Task title..."
                    value={modalTaskTitle}
                  />
                  <div className="task-modal-actions">
                    <button className="task-modal-confirm" type="submit">
                      Add
                    </button>
                    <button className="task-modal-cancel" onClick={closeAddTaskModal} type="button">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </main>

        <BottomNav active={activeSection} onChange={setActiveSection} />
      </div>
    </div>
  );
}









