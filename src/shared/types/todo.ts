export type TaskStatus = "active" | "completed";

export type TaskFilter = "all" | "active" | "completed";

export type SortMode = "status" | "date";

export type AppMode = "standard" | "widget";

export type GlobalStatus = "active" | "completed" | "terminated";

export type TaskLogType = "simple" | "exception" | "progress" | "conclusion";

export type WidgetAlignMode = "left" | "right";

export type StandardSection = "home" | "global" | "task" | "spark" | "tag" | "stats";

export interface TodoTask {
  id: string;
  title: string;
  executionDate: string;
  status: TaskStatus;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoGlobal {
  id: string;
  title: string;
  description?: string;
  status: GlobalStatus;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoTaskLog {
  id: string;
  taskId: string;
  type: TaskLogType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TodoSpark {
  id: string;
  title: string;
  description?: string;
  globalIds?: string[];
  taskIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAppData {
  schemaVersion: 2;
  tasks: TodoTask[];
  globals: TodoGlobal[];
  taskLogs: TodoTaskLog[];
  sparks: TodoSpark[];
  widgetShowAllTasks?: boolean;
  widgetAlignMode?: WidgetAlignMode;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface PersistedAppConfig {
  schemaVersion: number;
  widgetVisible: boolean;
  widgetPosition?: WidgetPosition;
}

export interface TaskStatusSyncPayload {
  taskId: string;
  status: TaskStatus;
  updatedAt: string;
  sourceWindowLabel?: string | null;
}

export interface TasksStateSyncPayload {
  tasks: TodoTask[];
  sourceWindowLabel?: string | null;
}

export interface WidgetTaskViewSyncPayload {
  showAllTasks: boolean;
  sourceWindowLabel?: string | null;
}

export interface WidgetAlignmentSyncPayload {
  alignMode: WidgetAlignMode;
  sourceWindowLabel?: string | null;
}
