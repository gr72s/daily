export type TaskStatus = "active" | "completed";

export type TaskKind = "task" | "delay";

export type TaskPriority = "urgent" | "high" | "normal";

export type WidgetColor = "blue" | "orange" | "red";

export type TaskFilter = "all" | "active" | "completed";

export type SortMode = "status" | "priority";

export type AppMode = "standard" | "widget";

export type GlobalStatus = "active" | "completed" | "terminated";

export type LogType = "exception" | "simple" | "spark" | "conclusion";

export type WidgetAlignMode = "left" | "right";

export type StandardSection = "home" | "global" | "task" | "stats";

export interface TodoTask {
  id: string;
  title: string;
  status: TaskStatus;
  kind: TaskKind;
  priority: TaskPriority;
  subtitle?: string;
  dueText?: string;
  hasException?: boolean;
  assignees?: string[];
  widgetColor: WidgetColor;
  tags?: string[];
  closedAt?: string;
  globalId?: string;
  parentTaskId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TodoGlobal {
  id: string;
  title: string;
  description?: string;
  status: GlobalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TodoLog {
  id: string;
  taskId?: string;
  type: LogType;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedAppData {
  schemaVersion: number;
  tasks: TodoTask[];
  globals: TodoGlobal[];
  logs: TodoLog[];
  widgetShowAllTasks?: boolean;
  widgetAlignMode?: WidgetAlignMode;
}

export interface PersistedAppConfig {
  schemaVersion: number;
  widgetVisible: boolean;
}

export interface TaskStatusSyncPayload {
  taskId: string;
  status: TaskStatus;
  closedAt?: string;
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
