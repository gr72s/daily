import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
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
    await existing.show();
    await existing.setFocus();
    return;
  }

  const widgetUrl = `${window.location.origin}/?mode=widget`;

  const widget = new WebviewWindow("widget", {
    url: widgetUrl,
    title: "Daily Widget",
    width: 360,
    height: 760,
    resizable: true,
    decorations: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    transparent: false,
    focus: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Widget window creation timeout."));
    }, 5000);

    void widget.once("tauri://created", async () => {
      window.clearTimeout(timeout);
      try {
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
