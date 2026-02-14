import { useEffect, useMemo, useState } from "react";
import { getWidgetOpacity, setWidgetPosition, watchWidgetOpacity } from "../../shared/settings/widget";
import {
  applyWidgetLockState,
  emitWidgetSetLock,
  focusMainWindow,
  getCurrentWindowLabelSafe,
  onWidgetAlignmentUpdated,
  onTaskStatusUpdated,
  onTasksStateUpdated,
  onWidgetTaskViewUpdated,
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
  const widgetShowAllTasks = useTodoStore((state) => state.widgetShowAllTasks);
  const widgetAlignMode = useTodoStore((state) => state.widgetAlignMode);
  const setWidgetLocked = useTodoStore((state) => state.setWidgetLocked);
  const setWidgetShowAllTasks = useTodoStore((state) => state.setWidgetShowAllTasks);
  const setWidgetAlignMode = useTodoStore((state) => state.setWidgetAlignMode);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const applySyncedTaskStatus = useTodoStore((state) => state.applySyncedTaskStatus);
  const applySyncedTasksState = useTodoStore((state) => state.applySyncedTasksState);
  const applySyncedWidgetTaskView = useTodoStore((state) => state.applySyncedWidgetTaskView);
  const applySyncedWidgetAlignment = useTodoStore((state) => state.applySyncedWidgetAlignment);
  const tasks = useTodoStore((state) => state.tasks);
  const sortMode = useTodoStore((state) => state.sortMode);
  const [widgetOpacity, setWidgetOpacity] = useState(() => getWidgetOpacity());
  const visibleTasks = useMemo(() => getWidgetTasks(tasks, sortMode, widgetShowAllTasks), [tasks, sortMode, widgetShowAllTasks]);

  const onToggleWidgetLock = () => {
    const nextLocked = !widgetLocked;
    setWidgetLocked(nextLocked);
    void syncWidgetLockedState(nextLocked);
    void emitWidgetSetLock(nextLocked);
  };

  const onToggleWidgetTaskView = () => {
    if (widgetLocked) {
      return;
    }
    setWidgetShowAllTasks(!widgetShowAllTasks);
  };

  const onToggleWidgetAlignMode = () => {
    const nextAlignMode = widgetAlignMode === "right" ? "left" : "right";
    setWidgetAlignMode(nextAlignMode);
  };

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

    const currentLabel = getCurrentWindowLabelSafe();
    let isDisposed = false;
    let unlistenForceUnlock: (() => void) | undefined;
    let unlistenSetLock: (() => void) | undefined;
    let unlistenMoved: (() => void) | undefined;
    let unlistenTaskSync: (() => void) | undefined;
    let unlistenTasksState: (() => void) | undefined;
    let unlistenWidgetTaskView: (() => void) | undefined;
    let unlistenWidgetAlignment: (() => void) | undefined;
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
      unlistenTaskSync = dispose;
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
      unlistenTasksState = dispose;
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
      if (unlistenTaskSync) {
        unlistenTaskSync();
      }
      if (unlistenTasksState) {
        unlistenTasksState();
      }
      if (unlistenWidgetTaskView) {
        unlistenWidgetTaskView();
      }
      if (unlistenWidgetAlignment) {
        unlistenWidgetAlignment();
      }
    };
  }, [applySyncedTaskStatus, applySyncedTasksState, applySyncedWidgetTaskView, applySyncedWidgetAlignment, setWidgetLocked]);

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
            className={`widget-icon-button widget-view-button${widgetShowAllTasks ? " is-all" : ""}`}
            disabled={widgetLocked}
            onClick={onToggleWidgetTaskView}
            type="button"
            aria-label={widgetShowAllTasks ? "Show active tasks only" : "Show all tasks"}
            title={widgetLocked ? "Unlock widget to change task visibility" : undefined}
          >
            {widgetShowAllTasks ? "All" : "Act"}
          </button>
          <button
            className={`widget-icon-button widget-align-button${widgetAlignMode === "left" ? " is-left" : " is-right"}`}
            onClick={onToggleWidgetAlignMode}
            type="button"
            aria-label={widgetAlignMode === "right" ? "Switch to left align" : "Switch to right align"}
          >
            {widgetAlignMode === "right" ? "R" : "L"}
          </button>
          <button
            className={`widget-icon-button widget-lock-button${widgetLocked ? " is-locked" : " is-unlocked"}`}
            onClick={onToggleWidgetLock}
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
            <WidgetTaskRow key={task.id} task={task} onToggle={toggleTask} alignMode={widgetAlignMode} />
          ))}
        </section>
      </main>
    </div>
  );
}
