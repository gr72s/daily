import { create } from "zustand";
import {
  getWidgetLocked,
  getWidgetPosition,
  setWidgetLocked as persistWidgetLocked,
  setWidgetPosition as persistWidgetPosition,
} from "../settings/widget";
import {
  emitTaskStatusUpdated,
  emitTasksStateUpdated,
  emitWidgetAlignmentUpdated,
  emitWidgetTaskViewUpdated,
  getCurrentWindowLabelSafe,
} from "../tauri/window";
import { priorityOrder } from "../theme/tokens";
import {
  loadPersistedAppConfig,
  loadPersistedAppData,
  savePersistedAppConfig,
  savePersistedAppData,
} from "../tauri/storage";
import type {
  GlobalStatus,
  LogType,
  PersistedAppConfig,
  PersistedAppData,
  SortMode,
  TaskFilter,
  TaskKind,
  TaskStatusSyncPayload,
  TasksStateSyncPayload,
  WidgetAlignMode,
  WidgetAlignmentSyncPayload,
  WidgetTaskViewSyncPayload,
  TodoGlobal,
  TodoLog,
  TodoTask,
} from "../types/todo";

interface UpdateGlobalInput {
  title?: string;
  description?: string;
  status?: GlobalStatus;
}

interface AddLogInput {
  taskId?: string;
  type: LogType;
  content: string;
}

interface TodoState {
  tasks: TodoTask[];
  globals: TodoGlobal[];
  logs: TodoLog[];
  selectedGlobalId: string | null;
  filter: TaskFilter;
  sortMode: SortMode;
  widgetLocked: boolean;
  widgetVisible: boolean;
  widgetShowAllTasks: boolean;
  widgetAlignMode: WidgetAlignMode;
  dataInitialized: boolean;
  toggleTask: (id: string) => void;
  applySyncedTaskStatus: (payload: TaskStatusSyncPayload) => void;
  applySyncedTasksState: (payload: TasksStateSyncPayload) => void;
  applySyncedWidgetTaskView: (payload: WidgetTaskViewSyncPayload) => void;
  applySyncedWidgetAlignment: (payload: WidgetAlignmentSyncPayload) => void;
  addTask: (title: string) => void;
  addTaskToGlobal: (globalId: string, title: string, kind: TaskKind) => void;
  addDelayToTask: (taskId: string, title: string) => void;
  addTaskTag: (taskId: string, tag: string) => void;
  removeTaskTag: (taskId: string, tag: string) => void;
  addGlobal: (title: string) => void;
  updateGlobal: (id: string, input: UpdateGlobalInput) => void;
  selectGlobal: (id: string | null) => void;
  addLog: (input: AddLogInput) => void;
  setFilter: (filter: TaskFilter) => void;
  setSortMode: (sortMode: SortMode) => void;
  setWidgetLocked: (locked: boolean) => void;
  toggleWidgetLocked: () => void;
  setWidgetVisible: (visible: boolean) => void;
  setWidgetShowAllTasks: (showAllTasks: boolean) => void;
  toggleWidgetShowAllTasks: () => void;
  setWidgetAlignMode: (alignMode: WidgetAlignMode) => void;
  toggleWidgetAlignMode: () => void;
  initializeData: () => Promise<void>;
}

const schemaVersion = 1;
const configSchemaVersion = 1;
const emptyTasks: TodoTask[] = [];
const emptyGlobals: TodoGlobal[] = [];
const emptyLogs: TodoLog[] = [];

function bySortMode(left: TodoTask, right: TodoTask, sortMode: SortMode) {
  if (sortMode === "priority") {
    const priorityCompare = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityCompare !== 0) {
      return priorityCompare;
    }
  }

  const statusCompare = Number(left.status === "completed") - Number(right.status === "completed");
  if (statusCompare !== 0) {
    return statusCompare;
  }

  if (sortMode === "status") {
    const priorityCompare = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityCompare !== 0) {
      return priorityCompare;
    }
  }

  return left.title.localeCompare(right.title);
}

function pickWidgetColor(kind: TaskKind): TodoTask["widgetColor"] {
  return kind === "delay" ? "orange" : "blue";
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTaskTags(tags: string[] | undefined) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const normalized: string[] = [];
  for (const rawTag of tags) {
    const tag = rawTag.trim();
    if (!tag || normalized.includes(tag)) {
      continue;
    }

    normalized.push(tag);
  }

  return normalized;
}

function toPersistedData(
  state: Pick<TodoState, "tasks" | "globals" | "logs" | "widgetShowAllTasks" | "widgetAlignMode">,
): PersistedAppData {
  return {
    schemaVersion,
    tasks: state.tasks,
    globals: state.globals,
    logs: state.logs,
    widgetShowAllTasks: state.widgetShowAllTasks,
    widgetAlignMode: state.widgetAlignMode,
  };
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(state: TodoState) {
  if (!state.dataInitialized) {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  const payload = toPersistedData(state);
  persistTimer = setTimeout(() => {
    void savePersistedAppData(payload);
  }, 200);
}

function normalizePersistedData(data: PersistedAppData | null) {
  if (!data || data.schemaVersion !== schemaVersion) {
    return null;
  }

  if (!Array.isArray(data.tasks) || !Array.isArray(data.globals) || !Array.isArray(data.logs)) {
    return null;
  }

  return data;
}

function normalizePersistedConfig(config: PersistedAppConfig | null) {
  if (!config || config.schemaVersion !== configSchemaVersion) {
    return null;
  }

  if (typeof config.widgetVisible !== "boolean") {
    return null;
  }

  if (
    typeof config.widgetPosition !== "undefined"
    && (
      typeof config.widgetPosition !== "object"
      || config.widgetPosition === null
      || typeof config.widgetPosition.x !== "number"
      || typeof config.widgetPosition.y !== "number"
    )
  ) {
    return null;
  }

  return config;
}

function buildPersistedConfig(widgetVisible: boolean): PersistedAppConfig {
  const widgetPosition = getWidgetPosition();
  return {
    schemaVersion: configSchemaVersion,
    widgetVisible,
    widgetPosition: widgetPosition ?? undefined,
  };
}

function applyMutation(get: () => TodoState, mutate: () => void) {
  mutate();
  schedulePersist(get());
}

export function getVisibleTasks(tasks: TodoTask[], filter: TaskFilter, sortMode: SortMode) {
  const filtered = tasks.filter((task) => {
    if (filter === "all") {
      return true;
    }

    if (filter === "active") {
      return task.status === "active";
    }

    return task.status === "completed";
  });

  return filtered.sort((left, right) => bySortMode(left, right, sortMode));
}

export function getWidgetTasks(tasks: TodoTask[], sortMode: SortMode, showAllTasks: boolean) {
  const sorted = [...tasks].sort((left, right) => bySortMode(left, right, sortMode));
  if (showAllTasks) {
    return sorted;
  }

  return sorted.filter((task) => task.status === "active").slice(0, 8);
}

export function getGlobalTasks(tasks: TodoTask[], globalId: string) {
  return tasks.filter((task) => task.globalId === globalId).sort((left, right) => bySortMode(left, right, "status"));
}

export function getLogsForGlobal(logs: TodoLog[], tasks: TodoTask[], globalId: string) {
  const taskIds = new Set(tasks.filter((task) => task.globalId === globalId).map((task) => task.id));
  return logs
    .filter((log) => (log.taskId ? taskIds.has(log.taskId) : true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export const useTodoStore = create<TodoState>((set, get) => ({
  tasks: emptyTasks,
  globals: emptyGlobals,
  logs: emptyLogs,
  selectedGlobalId: null,
  filter: "all",
  sortMode: "status",
  widgetLocked: getWidgetLocked(),
  widgetVisible: false,
  widgetShowAllTasks: false,
  widgetAlignMode: "right",
  dataInitialized: false,
  toggleTask: (id) => {
    let syncPayload: TaskStatusSyncPayload | null = null;
    applyMutation(get, () => {
      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.id !== id) {
            return task;
          }

          const nextStatus = task.status === "completed" ? "active" : "completed";
          const updatedAt = nowIso();
          const closedAt = nextStatus === "completed" ? updatedAt : undefined;
          syncPayload = {
            taskId: task.id,
            status: nextStatus,
            closedAt,
            updatedAt,
            sourceWindowLabel: getCurrentWindowLabelSafe(),
          };
          return {
            ...task,
            status: nextStatus,
            closedAt,
            updatedAt,
          };
        }),
      }));
    });

    if (syncPayload) {
      void emitTaskStatusUpdated(syncPayload);
    }
  },
  applySyncedTaskStatus: (payload) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== payload.taskId) {
          return task;
        }

        return {
          ...task,
          status: payload.status,
          closedAt: payload.closedAt,
          updatedAt: payload.updatedAt,
        };
      }),
    }));
  },
  applySyncedTasksState: ({ tasks }) => {
    set({ tasks });
  },
  applySyncedWidgetTaskView: ({ showAllTasks }) => {
    set({ widgetShowAllTasks: showAllTasks });
  },
  applySyncedWidgetAlignment: ({ alignMode }) => {
    set({ widgetAlignMode: alignMode });
  },
  addTask: (title) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      set((state) => ({
        tasks: [
          {
            id: crypto.randomUUID(),
            title: normalizedTitle,
            status: "active",
            kind: "task",
            priority: "normal",
            widgetColor: "blue",
            createdAt,
            updatedAt: createdAt,
          },
          ...state.tasks,
        ],
      }));
    });
    void emitTasksStateUpdated({
      tasks: get().tasks,
      sourceWindowLabel: getCurrentWindowLabelSafe(),
    });
  },
  addTaskToGlobal: (globalId, title, kind) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      set((state) => ({
        tasks: [
          {
            id: crypto.randomUUID(),
            title: normalizedTitle,
            status: "active",
            kind,
            priority: "normal",
            widgetColor: pickWidgetColor(kind),
            globalId,
            createdAt,
            updatedAt: createdAt,
          },
          ...state.tasks,
        ],
      }));
    });
    void emitTasksStateUpdated({
      tasks: get().tasks,
      sourceWindowLabel: getCurrentWindowLabelSafe(),
    });
  },
  addDelayToTask: (taskId, title) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      set((state) => {
        const parentTask = state.tasks.find((task) => task.id === taskId && task.kind === "task");
        if (!parentTask) {
          return state;
        }

        const createdAt = nowIso();
        return {
          tasks: [
            {
              id: crypto.randomUUID(),
              title: normalizedTitle,
              status: "active",
              kind: "delay",
              priority: "normal",
              widgetColor: "orange",
              globalId: parentTask.globalId,
              parentTaskId: parentTask.id,
              createdAt,
              updatedAt: createdAt,
            },
            ...state.tasks,
          ],
        };
      });
    });
    void emitTasksStateUpdated({
      tasks: get().tasks,
      sourceWindowLabel: getCurrentWindowLabelSafe(),
    });
  },
    addTaskTag: (taskId, tag) => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      return;
    }

    let updated = false;
    applyMutation(get, () => {
      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const nextTags = normalizeTaskTags([...(task.tags ?? []), normalizedTag]);
          const prevTags = normalizeTaskTags(task.tags);
          if (prevTags.length === nextTags.length && prevTags.every((value, index) => value === nextTags[index])) {
            return task;
          }

          updated = true;
          return {
            ...task,
            tags: nextTags.length > 0 ? nextTags : undefined,
            updatedAt: nowIso(),
          };
        }),
      }));
    });

    if (updated) {
      void emitTasksStateUpdated({
        tasks: get().tasks,
        sourceWindowLabel: getCurrentWindowLabelSafe(),
      });
    }
  },
  removeTaskTag: (taskId, tag) => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) {
      return;
    }

    let updated = false;
    applyMutation(get, () => {
      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          const prevTags = normalizeTaskTags(task.tags);
          const nextTags = prevTags.filter((item) => item !== normalizedTag);
          if (prevTags.length === nextTags.length) {
            return task;
          }

          updated = true;
          return {
            ...task,
            tags: nextTags.length > 0 ? nextTags : undefined,
            updatedAt: nowIso(),
          };
        }),
      }));
    });

    if (updated) {
      void emitTasksStateUpdated({
        tasks: get().tasks,
        sourceWindowLabel: getCurrentWindowLabelSafe(),
      });
    }
  },
  addGlobal: (title) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      const newGlobal: TodoGlobal = {
        id: crypto.randomUUID(),
        title: normalizedTitle,
        status: "active",
        createdAt,
        updatedAt: createdAt,
      };

      set((state) => ({
        globals: [newGlobal, ...state.globals],
        selectedGlobalId: newGlobal.id,
      }));
    });
  },
  updateGlobal: (id, input) => {
    applyMutation(get, () => {
      set((state) => ({
        globals: state.globals.map((globalItem) => {
          if (globalItem.id !== id) {
            return globalItem;
          }

          return {
            ...globalItem,
            ...input,
            updatedAt: nowIso(),
          };
        }),
      }));
    });
  },
  selectGlobal: (id) => set({ selectedGlobalId: id }),
  addLog: ({ content, taskId, type }) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      set((state) => ({
        logs: [
          {
            id: crypto.randomUUID(),
            taskId,
            type,
            content: normalizedContent,
            createdAt,
            updatedAt: createdAt,
          },
          ...state.logs,
        ],
        tasks:
          type === "exception" && taskId
            ? state.tasks.map((task) =>
                task.id === taskId ? { ...task, hasException: true, updatedAt: nowIso() } : task,
              )
            : state.tasks,
      }));
    });
  },
  setFilter: (filter) => set({ filter }),
  setSortMode: (sortMode) => set({ sortMode }),
  setWidgetLocked: (widgetLocked) => {
    persistWidgetLocked(widgetLocked);
    set({ widgetLocked });
  },
  toggleWidgetLocked: () =>
    set((state) => {
      const nextLocked = !state.widgetLocked;
      persistWidgetLocked(nextLocked);
      return { widgetLocked: nextLocked };
    }),
  setWidgetVisible: (widgetVisible) => {
    set({ widgetVisible });
    void savePersistedAppConfig(buildPersistedConfig(widgetVisible));
  },
  setWidgetShowAllTasks: (showAllTasks) => {
    applyMutation(get, () => {
      set({ widgetShowAllTasks: showAllTasks });
    });
    void emitWidgetTaskViewUpdated({
      showAllTasks,
      sourceWindowLabel: getCurrentWindowLabelSafe(),
    });
  },
  toggleWidgetShowAllTasks: () => {
    const nextShowAll = !get().widgetShowAllTasks;
    get().setWidgetShowAllTasks(nextShowAll);
  },
  setWidgetAlignMode: (alignMode) => {
    applyMutation(get, () => {
      set({ widgetAlignMode: alignMode });
    });
    void emitWidgetAlignmentUpdated({
      alignMode,
      sourceWindowLabel: getCurrentWindowLabelSafe(),
    });
  },
  toggleWidgetAlignMode: () => {
    const nextAlignMode: WidgetAlignMode = get().widgetAlignMode === "right" ? "left" : "right";
    get().setWidgetAlignMode(nextAlignMode);
  },
  initializeData: async () => {
    if (get().dataInitialized) {
      return;
    }

    try {
      const persistedConfig = normalizePersistedConfig(await loadPersistedAppConfig());
      const initialWidgetVisible = persistedConfig?.widgetVisible ?? false;
      if (!getWidgetPosition() && persistedConfig?.widgetPosition) {
        persistWidgetPosition(persistedConfig.widgetPosition);
      }
      if (!persistedConfig) {
        await savePersistedAppConfig(buildPersistedConfig(initialWidgetVisible));
      }

      const persisted = normalizePersistedData(await loadPersistedAppData());
      if (persisted) {
        set({
          tasks: persisted.tasks,
          globals: persisted.globals,
          logs: persisted.logs,
          widgetVisible: initialWidgetVisible,
          widgetShowAllTasks: persisted.widgetShowAllTasks ?? false,
          widgetAlignMode: persisted.widgetAlignMode ?? "right",
          selectedGlobalId: persisted.globals[0]?.id ?? null,
          dataInitialized: true,
        });
        return;
      }

      const emptyData: PersistedAppData = {
        schemaVersion,
        tasks: [],
        globals: [],
        logs: [],
        widgetShowAllTasks: false,
        widgetAlignMode: "right",
      };

      set({
        tasks: emptyData.tasks,
        globals: emptyData.globals,
        logs: emptyData.logs,
        widgetVisible: initialWidgetVisible,
        widgetShowAllTasks: emptyData.widgetShowAllTasks ?? false,
        widgetAlignMode: emptyData.widgetAlignMode ?? "right",
        selectedGlobalId: null,
        dataInitialized: true,
      });
      await savePersistedAppData(emptyData);
    } catch {
      set({
        tasks: [],
        globals: [],
        logs: [],
        widgetVisible: false,
        widgetShowAllTasks: false,
        widgetAlignMode: "right",
        selectedGlobalId: null,
        dataInitialized: true,
      });
    }
  },
}));
