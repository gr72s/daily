import { create } from "zustand";
import { getWidgetLocked, setWidgetLocked as persistWidgetLocked } from "../settings/widget";
import { priorityOrder } from "../theme/tokens";
import type { SortMode, TaskFilter, TodoTask } from "../types/todo";

interface TodoState {
  tasks: TodoTask[];
  filter: TaskFilter;
  sortMode: SortMode;
  widgetLocked: boolean;
  toggleTask: (id: string) => void;
  addTask: (title: string) => void;
  setFilter: (filter: TaskFilter) => void;
  setSortMode: (sortMode: SortMode) => void;
  setWidgetLocked: (locked: boolean) => void;
  toggleWidgetLocked: () => void;
}

const initialTasks: TodoTask[] = [
  {
    id: "t-1",
    title: "Update Tauri configuration for v2.0",
    status: "active",
    kind: "task",
    priority: "high",
    subtitle: "Rust · High Priority",
    dueText: "Today",
    widgetColor: "blue",
    tags: ["rust"],
  },
  {
    id: "t-2",
    title: "Design review with engineering team",
    status: "active",
    kind: "task",
    priority: "normal",
    subtitle: "Meeting • 2:00 PM",
    assignees: ["AL", "TM"],
    widgetColor: "red",
  },
  {
    id: "t-3",
    title: "Reply to client emails",
    status: "completed",
    kind: "task",
    priority: "normal",
    widgetColor: "orange",
    closedAt: "2026-02-14T08:00:00.000Z",
  },
  {
    id: "t-4",
    title: "Refactor sidebar navigation component",
    status: "active",
    kind: "task",
    priority: "normal",
    subtitle: "Frontend",
    widgetColor: "blue",
  },
  {
    id: "t-5",
    title: "Write documentation for expanded mode",
    status: "active",
    kind: "delay",
    priority: "normal",
    dueText: "Tomorrow",
    widgetColor: "orange",
  },
  {
    id: "t-6",
    title: "Fix responsive layout bugs on iOS",
    status: "active",
    kind: "task",
    priority: "urgent",
    subtitle: "Urgent",
    widgetColor: "red",
    hasException: true,
  },
];

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

export function getWidgetTasks(tasks: TodoTask[], sortMode: SortMode) {
  return [...tasks]
    .filter((task) => task.status === "active")
    .sort((left, right) => bySortMode(left, right, sortMode))
    .slice(0, 8);
}

export const useTodoStore = create<TodoState>((set) => ({
  tasks: initialTasks,
  filter: "all",
  sortMode: "status",
  widgetLocked: getWidgetLocked(),
  toggleTask: (id) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id !== id) {
          return task;
        }

        const nextStatus = task.status === "completed" ? "active" : "completed";
        return {
          ...task,
          status: nextStatus,
          closedAt: nextStatus === "completed" ? new Date().toISOString() : undefined,
        };
      }),
    }));
  },
  addTask: (title) => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return;
    }

    set((state) => ({
      tasks: [
        {
          id: crypto.randomUUID(),
          title: normalizedTitle,
          status: "active",
          kind: "task",
          priority: "normal",
          widgetColor: "blue",
        },
        ...state.tasks,
      ],
    }));
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
}));
