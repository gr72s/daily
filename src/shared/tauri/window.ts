import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getWidgetLocked, getWidgetPosition } from "../settings/widget";
import type {
  AppMode,
  TaskStatusSyncPayload,
  TasksStateSyncPayload,
  WidgetAlignmentSyncPayload,
  WidgetTaskViewSyncPayload,
} from "../types/todo";

const taskStatusUpdatedEvent = "task-status-updated";
const tasksStateUpdatedEvent = "tasks-state-updated";
const widgetSetLockStateEvent = "widget-set-lock-state";
const widgetSetVisibilityStateEvent = "widget-set-visibility-state";
const widgetTaskViewUpdatedEvent = "widget-task-view-updated";
const widgetAlignmentUpdatedEvent = "widget-alignment-updated";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __DAILY_MODE__?: string;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

async function removeWindowShadowSafe(target: { setShadow: (enable: boolean) => Promise<void> }) {
  try {
    await target.setShadow(false);
  } catch {
    // Ignore platform/runtime differences for shadow support.
  }
}

export function detectAppMode(): AppMode {
  if (window.__DAILY_MODE__ === "widget") {
    return "widget";
  }

  try {
    if (!isTauriRuntime()) {
      const params = new URLSearchParams(window.location.search);
      return params.get("mode") === "widget" ? "widget" : "standard";
    }

    return getCurrentWebviewWindow().label === "widget" ? "widget" : "standard";
  } catch {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "widget" ? "widget" : "standard";
  }
}

export async function ensureWidgetWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  const existing = await WebviewWindow.getByLabel("widget");
  if (existing) {
    const locked = getWidgetLocked();
    await removeWindowShadowSafe(existing);
    await existing.setIgnoreCursorEvents(locked);
    await existing.setFocusable(!locked);
    await existing.show();
    if (!locked) {
      await existing.setFocus();
    }
    return;
  }

  const widgetUrl = `${window.location.origin}/?mode=widget`;
  const widgetPosition = getWidgetPosition();

  const widget = new WebviewWindow("widget", {
    url: widgetUrl,
    title: "Daily Widget",
    width: 360,
    height: 760,
    x: widgetPosition?.x,
    y: widgetPosition?.y,
    resizable: false,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    focus: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Widget window creation timeout."));
    }, 5000);

    void widget.once("tauri://created", async () => {
      window.clearTimeout(timeout);
      try {
        await removeWindowShadowSafe(widget);
        await widget.show();
        await widget.setFocus();
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    void widget.once("tauri://error", (error) => {
      window.clearTimeout(timeout);
      reject(new Error(typeof error.payload === "string" ? error.payload : "Failed to create widget window."));
    });
  });
}

export async function setWidgetWindowVisibility(visible: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  if (visible) {
    await ensureWidgetWindow();
    return;
  }

  const existing = await WebviewWindow.getByLabel("widget");
  if (!existing) {
    return;
  }

  await existing.hide();
}

export async function focusMainWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  const main = await WebviewWindow.getByLabel("main");
  if (!main) {
    return;
  }

  await main.show();
  await main.setFocus();
}

export async function applyWidgetLockState(locked: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  const current = getCurrentWebviewWindow();
  if (current.label !== "widget") {
    return;
  }

  await current.setAlwaysOnTop(true);
  await current.setResizable(false);
  await removeWindowShadowSafe(current);
  await current.setIgnoreCursorEvents(locked);
  await current.setFocusable(!locked);
  if (!locked) {
    await current.setFocus();
  }
}

export async function startWidgetDragging() {
  if (!isTauriRuntime()) {
    return;
  }

  const current = getCurrentWebviewWindow();
  if (current.label !== "widget") {
    return;
  }

  await current.startDragging();
}

export async function onWidgetForceUnlock(handler: () => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const current = getCurrentWebviewWindow();
  return current.listen("widget-force-unlock", () => {
    handler();
  });
}

export async function onWidgetToggleLock(handler: () => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const current = getCurrentWebviewWindow();
  return current.listen("widget-toggle-lock-shortcut", () => {
    handler();
  });
}

export async function onWidgetSetLock(handler: (locked: boolean) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const current = getCurrentWebviewWindow();
  return current.listen<boolean>("widget-set-lock-state", (event) => {
    if (typeof event.payload === "boolean") {
      handler(event.payload);
    }
  });
}

export async function onWidgetSetVisibility(handler: (visible: boolean) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const current = getCurrentWebviewWindow();
  return current.listen<boolean>(widgetSetVisibilityStateEvent, (event) => {
    if (typeof event.payload === "boolean") {
      handler(event.payload);
    }
  });
}

export async function syncWidgetLockedState(locked: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("sync_widget_locked_state", { locked });
}

export async function syncWidgetVisibilityState(visible: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("sync_widget_visibility_state", { visible });
}

export async function onWidgetMoved(handler: (position: { x: number; y: number }) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  const current = getCurrentWebviewWindow();
  if (current.label !== "widget") {
    return () => {};
  }

  return current.onMoved(({ payload }) => {
    handler({ x: payload.x, y: payload.y });
  });
}

export function getCurrentWindowLabelSafe() {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return getCurrentWebviewWindow().label;
  } catch {
    return null;
  }
}

export async function emitTaskStatusUpdated(payload: TaskStatusSyncPayload) {
  if (!isTauriRuntime()) {
    return;
  }

  await emit<TaskStatusSyncPayload>(taskStatusUpdatedEvent, payload);
}

export async function onTaskStatusUpdated(handler: (payload: TaskStatusSyncPayload) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return listen<TaskStatusSyncPayload>(taskStatusUpdatedEvent, (event) => {
    handler(event.payload);
  });
}

export async function emitTasksStateUpdated(payload: TasksStateSyncPayload) {
  if (!isTauriRuntime()) {
    return;
  }

  await emit<TasksStateSyncPayload>(tasksStateUpdatedEvent, payload);
}

export async function onTasksStateUpdated(handler: (payload: TasksStateSyncPayload) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return listen<TasksStateSyncPayload>(tasksStateUpdatedEvent, (event) => {
    handler(event.payload);
  });
}

export async function emitWidgetSetLock(locked: boolean) {
  if (!isTauriRuntime()) {
    return;
  }

  await emit<boolean>(widgetSetLockStateEvent, locked);
}

export async function emitWidgetTaskViewUpdated(payload: WidgetTaskViewSyncPayload) {
  if (!isTauriRuntime()) {
    return;
  }

  await emit<WidgetTaskViewSyncPayload>(widgetTaskViewUpdatedEvent, payload);
}

export async function onWidgetTaskViewUpdated(handler: (payload: WidgetTaskViewSyncPayload) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return listen<WidgetTaskViewSyncPayload>(widgetTaskViewUpdatedEvent, (event) => {
    handler(event.payload);
  });
}

export async function emitWidgetAlignmentUpdated(payload: WidgetAlignmentSyncPayload) {
  if (!isTauriRuntime()) {
    return;
  }

  await emit<WidgetAlignmentSyncPayload>(widgetAlignmentUpdatedEvent, payload);
}

export async function onWidgetAlignmentUpdated(handler: (payload: WidgetAlignmentSyncPayload) => void) {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return listen<WidgetAlignmentSyncPayload>(widgetAlignmentUpdatedEvent, (event) => {
    handler(event.payload);
  });
}
