import { useEffect, useMemo, useState } from "react";
import { getWidgetOpacity, setWidgetPosition, watchWidgetOpacity } from "../../shared/settings/widget";
import {
  applyWidgetLockState,
  focusMainWindow,
  onWidgetForceUnlock,
  onWidgetMoved,
  onWidgetSetLock,
  syncWidgetLockedState,
  startWidgetDragging,
} from "../../shared/tauri/window";
import { getWidgetTasks, useTodoStore } from "../../shared/state/useTodoStore";
import { WidgetTaskRow } from "./WidgetTaskRow";

export function WidgetModePage() {
  const widgetLocked = useTodoStore((state) => state.widgetLocked);
  const setWidgetLocked = useTodoStore((state) => state.setWidgetLocked);
  const toggleWidgetLocked = useTodoStore((state) => state.toggleWidgetLocked);
  const tasks = useTodoStore((state) => state.tasks);
  const sortMode = useTodoStore((state) => state.sortMode);
  const [widgetOpacity, setWidgetOpacity] = useState(() => getWidgetOpacity());
  const visibleTasks = useMemo(() => getWidgetTasks(tasks, sortMode), [tasks, sortMode]);

  useEffect(() => {
    document.documentElement.classList.add("widget-mode");
    document.body.classList.add("widget-mode");

    return () => {
      document.documentElement.classList.remove("widget-mode");
      document.body.classList.remove("widget-mode");
    };
  }, []);

  useEffect(() => {
    void applyWidgetLockState(widgetLocked);
    void syncWidgetLockedState(widgetLocked);
  }, [widgetLocked]);

  useEffect(() => {
    const stopWatchOpacity = watchWidgetOpacity((nextOpacity) => {
      setWidgetOpacity(nextOpacity);
    });

    let isDisposed = false;
    let unlistenForceUnlock: (() => void) | undefined;
    let unlistenSetLock: (() => void) | undefined;
    let unlistenMoved: (() => void) | undefined;
    void onWidgetForceUnlock(() => {
      setWidgetLocked(false);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenForceUnlock = dispose;
    });

    void onWidgetSetLock((locked) => {
      setWidgetLocked(locked);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenSetLock = dispose;
    });

    void onWidgetMoved((position) => {
      setWidgetPosition(position);
    }).then((dispose) => {
      if (isDisposed) {
        dispose();
        return;
      }
      unlistenMoved = dispose;
    });

    return () => {
      isDisposed = true;
      stopWatchOpacity();
      if (unlistenForceUnlock) {
        unlistenForceUnlock();
      }
      if (unlistenSetLock) {
        unlistenSetLock();
      }
      if (unlistenMoved) {
        unlistenMoved();
      }
    };
  }, [setWidgetLocked]);

  return (
    <div className="widget-page">
      <main className={`widget-panel${widgetLocked ? " is-locked" : ""}`} style={{ opacity: widgetOpacity / 100 }}>
        <header className="widget-toolbar">
          <div
            className={`widget-drag-region${widgetLocked ? " is-disabled" : ""}`}
            data-tauri-drag-region={!widgetLocked ? "true" : undefined}
            onMouseDown={() => {
              if (!widgetLocked) {
                void startWidgetDragging();
              }
            }}
            aria-hidden="true"
          />
          <button className="widget-icon-button" onClick={() => void focusMainWindow()} type="button" aria-label="Expand widget">
            ⤢
          </button>
          <button
            className={`widget-icon-button widget-lock-button${widgetLocked ? " is-locked" : " is-unlocked"}`}
            onClick={toggleWidgetLocked}
            type="button"
            aria-label={widgetLocked ? "Unlock widget" : "Lock widget"}
          >
            <span className="widget-lock-icon" aria-hidden="true">
              {widgetLocked ? "🔐" : "✎"}
            </span>
            <span>{widgetLocked ? "Locked" : "Unlocked"}</span>
          </button>
        </header>

        <p className="widget-status">{widgetLocked ? "Locked · click-through enabled" : "Unlocked · draggable"}</p>

        <section className={`widget-task-list${widgetLocked ? " is-locked" : ""}`} aria-label="Widget tasks">
          {visibleTasks.map((task) => (
            <WidgetTaskRow key={task.id} task={task} />
          ))}
        </section>
      </main>
    </div>
  );
}
