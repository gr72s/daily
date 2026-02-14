import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getWidgetLocked, getWidgetPosition } from "../settings/widget";
import type { AppMode } from "../types/todo";

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
