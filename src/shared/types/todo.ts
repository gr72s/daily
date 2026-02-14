export type TaskStatus = "active" | "completed";

export type TaskKind = "task" | "delay";

export type TaskPriority = "urgent" | "high" | "normal";

export type WidgetColor = "blue" | "orange" | "red";

export type TaskFilter = "all" | "active" | "completed";

export type SortMode = "status" | "priority";

export type AppMode = "standard" | "widget";

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
}
