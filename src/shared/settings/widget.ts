const widgetOpacityKey = "daily.widget.opacity";
const widgetHoverOpacityKey = "daily.widget.hoverOpacity";
const widgetScaleKey = "daily.widget.scale";
const widgetLockedKey = "daily.widget.locked";
const widgetPositionKey = "daily.widget.position";

export interface WidgetPosition {
  x: number;
  y: number;
}

function clampOpacity(value: number) {
  if (Number.isNaN(value)) {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampScale(value: number) {
  if (Number.isNaN(value)) {
    return 100;
  }

  return Math.max(70, Math.min(300, Math.round(value)));
}

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getWidgetOpacity() {
  if (!hasLocalStorage()) {
    return 20;
  }

  const raw = localStorage.getItem(widgetOpacityKey);
  if (raw === null) {
    return 20;
  }

  return clampOpacity(Number(raw));
}

export function setWidgetOpacity(opacity: number) {
  if (!hasLocalStorage()) {
    return;
  }

  const normalized = clampOpacity(opacity);
  localStorage.setItem(widgetOpacityKey, String(normalized));
}

export function watchWidgetOpacity(onChange: (opacity: number) => void) {
  if (!hasLocalStorage()) {
    return () => {};
  }

  const handler = (event: StorageEvent) => {
    if (event.key !== widgetOpacityKey) {
      return;
    }

    onChange(clampOpacity(Number(event.newValue)));
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function getWidgetHoverOpacity() {
  if (!hasLocalStorage()) {
    return 38;
  }

  const raw = localStorage.getItem(widgetHoverOpacityKey);
  if (raw === null) {
    return 38;
  }

  return clampOpacity(Number(raw));
}

export function setWidgetHoverOpacity(opacity: number) {
  if (!hasLocalStorage()) {
    return;
  }

  const normalized = clampOpacity(opacity);
  localStorage.setItem(widgetHoverOpacityKey, String(normalized));
}

export function watchWidgetHoverOpacity(onChange: (opacity: number) => void) {
  if (!hasLocalStorage()) {
    return () => {};
  }

  const handler = (event: StorageEvent) => {
    if (event.key !== widgetHoverOpacityKey) {
      return;
    }

    onChange(clampOpacity(Number(event.newValue)));
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function getWidgetScale() {
  if (!hasLocalStorage()) {
    return 100;
  }

  const raw = localStorage.getItem(widgetScaleKey);
  if (raw === null) {
    return 100;
  }

  return clampScale(Number(raw));
}

export function setWidgetScale(scale: number) {
  if (!hasLocalStorage()) {
    return;
  }

  const normalized = clampScale(scale);
  localStorage.setItem(widgetScaleKey, String(normalized));
}

export function watchWidgetScale(onChange: (scale: number) => void) {
  if (!hasLocalStorage()) {
    return () => {};
  }

  const handler = (event: StorageEvent) => {
    if (event.key !== widgetScaleKey) {
      return;
    }

    onChange(clampScale(Number(event.newValue)));
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

export function getWidgetLocked() {
  if (!hasLocalStorage()) {
    return false;
  }

  return localStorage.getItem(widgetLockedKey) === "true";
}

export function setWidgetLocked(locked: boolean) {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(widgetLockedKey, String(locked));
}

export function getWidgetPosition(): WidgetPosition | null {
  if (!hasLocalStorage()) {
    return null;
  }

  const raw = localStorage.getItem(widgetPositionKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WidgetPosition>;
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return {
        x: Math.round(parsed.x),
        y: Math.round(parsed.y),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function setWidgetPosition(position: WidgetPosition) {
  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(
    widgetPositionKey,
    JSON.stringify({
      x: Math.round(position.x),
      y: Math.round(position.y),
    }),
  );
}

