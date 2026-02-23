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

function normalizeUnknownErrorMessage(raw: unknown) {
  if (raw instanceof Error && raw.message) {
    return raw.message;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw;
  }
  return "unknown error";
}

export function normalizePersistWriteError(raw: unknown, target: "data" | "config") {
  if (raw instanceof Error && raw.message.startsWith("数据写入失败（")) {
    return raw;
  }

  const targetFile = target === "data" ? "data.json" : "config.json";
  const detail = normalizeUnknownErrorMessage(raw);
  return new Error(`数据写入失败（${targetFile}）: ${detail}`);
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

  try {
    await invoke("save_app_data", { data });
  } catch (error) {
    throw normalizePersistWriteError(error, "data");
  }
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

  try {
    await invoke("save_app_config", { config });
  } catch (error) {
    throw normalizePersistWriteError(error, "config");
  }
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
