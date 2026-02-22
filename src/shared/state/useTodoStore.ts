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
import {
  loadPersistedAppConfig,
  loadPersistedAppData,
  savePersistedAppConfig,
  savePersistedAppData,
} from "../tauri/storage";
import type {
  GlobalStatus,
  PersistedAppConfig,
  PersistedAppData,
  SortMode,
  TaskFilter,
  TaskLogType,
  TaskStatus,
  TaskStatusSyncPayload,
  TasksStateSyncPayload,
  TodoGlobal,
  TodoSpark,
  TodoTask,
  TodoTaskLog,
  WidgetAlignMode,
  WidgetAlignmentSyncPayload,
  WidgetTaskViewSyncPayload,
} from "../types/todo";

interface AddTaskInput {
  title: string;
  executionDate?: string;
  status?: TaskStatus;
  tags?: string[];
}

interface UpdateTaskInput {
  title?: string;
  executionDate?: string;
  status?: TaskStatus;
  tags?: string[];
}

interface AddGlobalInput {
  title: string;
  description?: string;
  status?: GlobalStatus;
  startDate?: string;
}

interface UpdateGlobalInput {
  title?: string;
  description?: string;
  status?: GlobalStatus;
  startDate?: string;
}

interface AddTaskLogInput {
  taskId: string;
  type: TaskLogType;
  content: string;
}

interface AddSparkInput {
  title: string;
  description?: string;
  globalIds?: string[];
  taskIds?: string[];
}

interface UpdateSparkInput {
  title?: string;
  description?: string;
  globalIds?: string[];
  taskIds?: string[];
}

interface TodoState {
  tasks: TodoTask[];
  globals: TodoGlobal[];
  taskLogs: TodoTaskLog[];
  sparks: TodoSpark[];
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
  addTask: (input: AddTaskInput) => void;
  updateTask: (id: string, input: UpdateTaskInput) => void;
  addTaskTag: (taskId: string, tag: string) => void;
  removeTaskTag: (taskId: string, tag: string) => void;
  addGlobal: (input: AddGlobalInput) => void;
  updateGlobal: (id: string, input: UpdateGlobalInput) => void;
  selectGlobal: (id: string | null) => void;
  addTaskLog: (input: AddTaskLogInput) => void;
  addSpark: (input: AddSparkInput) => void;
  updateSpark: (id: string, input: UpdateSparkInput) => void;
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

const schemaVersion = 2 as const;
const configSchemaVersion = 1;
const emptyTasks: TodoTask[] = [];
const emptyGlobals: TodoGlobal[] = [];
const emptyTaskLogs: TodoTaskLog[] = [];
const emptySparks: TodoSpark[] = [];

function nowIso() {
  return new Date().toISOString();
}

function todayDateKey() {
  return nowIso().slice(0, 10);
}

function normalizeDateKey(value: string | undefined) {
  if (!value) {
    return todayDateKey();
  }

  const normalized = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  return todayDateKey();
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

function normalizeIdList(values: string[] | undefined, allowedIds: Set<string>) {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id || normalized.includes(id) || !allowedIds.has(id)) {
      continue;
    }
    normalized.push(id);
  }
  return normalized;
}

function bySortMode(left: TodoTask, right: TodoTask, sortMode: SortMode) {
  const leftStatusRank = left.status === "active" ? 0 : 1;
  const rightStatusRank = right.status === "active" ? 0 : 1;

  if (sortMode === "status") {
    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank;
    }
    const dateCompare = left.executionDate.localeCompare(right.executionDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.title.localeCompare(right.title);
  }

  const dateCompare = right.executionDate.localeCompare(left.executionDate);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  if (leftStatusRank !== rightStatusRank) {
    return leftStatusRank - rightStatusRank;
  }

  return left.title.localeCompare(right.title);
}

function toPersistedData(
  state: Pick<TodoState, "tasks" | "globals" | "taskLogs" | "sparks" | "widgetShowAllTasks" | "widgetAlignMode">,
): PersistedAppData {
  return {
    schemaVersion,
    tasks: state.tasks,
    globals: state.globals,
    taskLogs: state.taskLogs,
    sparks: state.sparks,
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

  if (!Array.isArray(data.tasks) || !Array.isArray(data.globals) || !Array.isArray(data.taskLogs) || !Array.isArray(data.sparks)) {
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

export const useTodoStore = create<TodoState>((set, get) => ({
  tasks: emptyTasks,
  globals: emptyGlobals,
  taskLogs: emptyTaskLogs,
  sparks: emptySparks,
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

          const nextStatus: TaskStatus = task.status === "completed" ? "active" : "completed";
          const updatedAt = nowIso();
          syncPayload = {
            taskId: task.id,
            status: nextStatus,
            updatedAt,
            sourceWindowLabel: getCurrentWindowLabelSafe(),
          };
          return {
            ...task,
            status: nextStatus,
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
  addTask: ({ title, executionDate, status, tags }) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      const normalizedTags = normalizeTaskTags(tags);
      set((state) => ({
        tasks: [
          {
            id: crypto.randomUUID(),
            title: normalizedTitle,
            executionDate: normalizeDateKey(executionDate),
            status: status ?? "active",
            tags: normalizedTags.length > 0 ? normalizedTags : undefined,
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
  updateTask: (id, input) => {
    let updated = false;
    applyMutation(get, () => {
      set((state) => ({
        tasks: state.tasks.map((task) => {
          if (task.id !== id) {
            return task;
          }

          const nextTitle = typeof input.title === "string" ? input.title.trim() : task.title;
          if (!nextTitle) {
            return task;
          }

          const nextExecutionDate = input.executionDate ? normalizeDateKey(input.executionDate) : task.executionDate;
          const nextStatus = input.status ?? task.status;
          const nextTags = typeof input.tags !== "undefined" ? normalizeTaskTags(input.tags) : normalizeTaskTags(task.tags);

          const hasChanges =
            nextTitle !== task.title
            || nextExecutionDate !== task.executionDate
            || nextStatus !== task.status
            || JSON.stringify(nextTags) !== JSON.stringify(normalizeTaskTags(task.tags));

          if (!hasChanges) {
            return task;
          }

          updated = true;
          return {
            ...task,
            title: nextTitle,
            executionDate: nextExecutionDate,
            status: nextStatus,
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
  addGlobal: ({ title, description, status, startDate }) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      const normalizedDescription = description?.trim();
      const newGlobal: TodoGlobal = {
        id: crypto.randomUUID(),
        title: normalizedTitle,
        description: normalizedDescription ? normalizedDescription : undefined,
        status: status ?? "active",
        startDate: normalizeDateKey(startDate),
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

          const nextTitle = typeof input.title === "string" ? input.title.trim() : globalItem.title;
          if (!nextTitle) {
            return globalItem;
          }

          return {
            ...globalItem,
            title: nextTitle,
            description: typeof input.description === "string"
              ? (input.description.trim() ? input.description.trim() : undefined)
              : globalItem.description,
            status: input.status ?? globalItem.status,
            startDate: input.startDate ? normalizeDateKey(input.startDate) : globalItem.startDate,
            updatedAt: nowIso(),
          };
        }),
      }));
    });
  },
  selectGlobal: (id) => set({ selectedGlobalId: id }),
  addTaskLog: ({ taskId, type, content }) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    if (!get().tasks.some((task) => task.id === taskId)) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      set((state) => ({
        taskLogs: [
          {
            id: crypto.randomUUID(),
            taskId,
            type,
            content: normalizedContent,
            createdAt,
            updatedAt: createdAt,
          },
          ...state.taskLogs,
        ],
      }));
    });
  },
  addSpark: ({ title, description, globalIds, taskIds }) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    applyMutation(get, () => {
      const createdAt = nowIso();
      const globalIdSet = new Set(get().globals.map((globalItem) => globalItem.id));
      const taskIdSet = new Set(get().tasks.map((task) => task.id));
      const normalizedGlobalIds = normalizeIdList(globalIds, globalIdSet);
      const normalizedTaskIds = normalizeIdList(taskIds, taskIdSet);
      const normalizedDescription = description?.trim();

      const nextSpark: TodoSpark = {
        id: crypto.randomUUID(),
        title: normalizedTitle,
        description: normalizedDescription ? normalizedDescription : undefined,
        globalIds: normalizedGlobalIds.length > 0 ? normalizedGlobalIds : undefined,
        taskIds: normalizedTaskIds.length > 0 ? normalizedTaskIds : undefined,
        createdAt,
        updatedAt: createdAt,
      };

      set((state) => ({
        sparks: [nextSpark, ...state.sparks],
      }));
    });
  },
  updateSpark: (id, input) => {
    applyMutation(get, () => {
      const globalIdSet = new Set(get().globals.map((globalItem) => globalItem.id));
      const taskIdSet = new Set(get().tasks.map((task) => task.id));

      set((state) => ({
        sparks: state.sparks.map((spark) => {
          if (spark.id !== id) {
            return spark;
          }

          const nextTitle = typeof input.title === "string" ? input.title.trim() : spark.title;
          if (!nextTitle) {
            return spark;
          }

          const nextDescription = typeof input.description === "string"
            ? (input.description.trim() ? input.description.trim() : undefined)
            : spark.description;
          const nextGlobalIds = typeof input.globalIds !== "undefined"
            ? normalizeIdList(input.globalIds, globalIdSet)
            : (spark.globalIds ?? []);
          const nextTaskIds = typeof input.taskIds !== "undefined"
            ? normalizeIdList(input.taskIds, taskIdSet)
            : (spark.taskIds ?? []);

          return {
            ...spark,
            title: nextTitle,
            description: nextDescription,
            globalIds: nextGlobalIds.length > 0 ? nextGlobalIds : undefined,
            taskIds: nextTaskIds.length > 0 ? nextTaskIds : undefined,
            updatedAt: nowIso(),
          };
        }),
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
          taskLogs: persisted.taskLogs,
          sparks: persisted.sparks,
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
        taskLogs: [],
        sparks: [],
        widgetShowAllTasks: false,
        widgetAlignMode: "right",
      };

      set({
        tasks: emptyData.tasks,
        globals: emptyData.globals,
        taskLogs: emptyData.taskLogs,
        sparks: emptyData.sparks,
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
        taskLogs: [],
        sparks: [],
        widgetVisible: false,
        widgetShowAllTasks: false,
        widgetAlignMode: "right",
        selectedGlobalId: null,
        dataInitialized: true,
      });
    }
  },
}));
