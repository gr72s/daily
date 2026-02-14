import { invoke } from "@tauri-apps/api/core";
import type { PersistedAppConfig, PersistedAppData } from "../types/todo";

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
