import { useMemo } from "react";
import { focusMainWindow } from "../../shared/tauri/window";
import { getWidgetTasks, useTodoStore } from "../../shared/state/useTodoStore";
import { WidgetTaskRow } from "./WidgetTaskRow";

export function WidgetModePage() {
  const widgetLocked = useTodoStore((state) => state.widgetLocked);
  const setWidgetLocked = useTodoStore((state) => state.setWidgetLocked);
  const tasks = useTodoStore((state) => state.tasks);
  const sortMode = useTodoStore((state) => state.sortMode);
  const visibleTasks = useMemo(() => getWidgetTasks(tasks, sortMode), [tasks, sortMode]);

  return (
    <div className="widget-page">
      <main className="widget-panel">
        <header className="widget-toolbar">
          <button className="widget-icon-button" onClick={() => void focusMainWindow()} type="button" aria-label="Expand widget">
            ⤢
          </button>
          <button
            className="widget-icon-button"
            onClick={() => setWidgetLocked(!widgetLocked)}
            type="button"
            aria-label={widgetLocked ? "Unlock widget" : "Lock widget"}
          >
            {widgetLocked ? "🔒" : "🔓"}
          </button>
        </header>

        <section className="widget-task-list" aria-label="Widget tasks">
          {visibleTasks.map((task) => (
            <WidgetTaskRow key={task.id} task={task} />
          ))}
        </section>
      </main>
    </div>
  );
}
