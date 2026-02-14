import type { TaskPriority, WidgetColor } from "../types/todo";

export const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
};

export const widgetColorClass: Record<WidgetColor, string> = {
  blue: "widget-dot-blue",
  orange: "widget-dot-orange",
  red: "widget-dot-red",
};
