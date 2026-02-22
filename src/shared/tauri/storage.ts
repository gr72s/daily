import { invoke } from "@tauri-apps/api/core";
import type { PersistedAppConfig, PersistedAppData, WidgetPosition } from "../types/todo";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

function isTauriRuntime() {
  return typeof window !== "undefined" && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

export async function loadPersistedAppData() {
  if (!isTauriRuntime()) {
    return null;
  }

  const data = await invoke<PersistedAppData | null>("load_app_data");
  return data;
}

export async function savePersistedAppData(data: PersistedAppData) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("save_app_data", { data });
}

export async function loadPersistedAppConfig() {
  if (!isTauriRuntime()) {
    return null;
  }

  const config = await invoke<PersistedAppConfig | null>("load_app_config");
  return config;
}

export async function savePersistedAppConfig(config: PersistedAppConfig) {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("save_app_config", { config });
}

export async function saveWidgetPositionToPersistedAppConfig(position: WidgetPosition) {
  if (!isTauriRuntime()) {
    return;
  }

  const current = await loadPersistedAppConfig();
  const next: PersistedAppConfig = {
    schemaVersion: typeof current?.schemaVersion === "number" ? current.schemaVersion : 1,
    widgetVisible: typeof current?.widgetVisible === "boolean" ? current.widgetVisible : false,
    widgetPosition: {
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
  };

  await savePersistedAppConfig(next);
}
