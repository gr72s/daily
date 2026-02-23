import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTodoStore } from "../../shared/state/useTodoStore";
import type { TaskLogType, TaskStatus, TodoTask } from "../../shared/types/todo";

type SortDirection = "asc" | "desc";
type TaskSortField = "status" | "executionDate" | "title";

const taskLogTypes: TaskLogType[] = ["simple", "progress", "exception", "conclusion"];
const taskSortDefaultDirection: Record<TaskSortField, SortDirection> = {
  status: "asc",
  executionDate: "desc",
  title: "asc",
};
const taskPageSize = 10;

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTagsFromInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag, index, all) => Boolean(tag) && all.indexOf(tag) === index);
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function compareByTaskField(left: TodoTask, right: TodoTask, field: TaskSortField) {
  if (field === "status") {
    const leftStatusRank = left.status === "active" ? 0 : 1;
    const rightStatusRank = right.status === "active" ? 0 : 1;
    const statusCompare = leftStatusRank - rightStatusRank;
    if (statusCompare !== 0) {
      return statusCompare;
    }
  }

  if (field === "executionDate") {
    const dateCompare = left.executionDate.localeCompare(right.executionDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
  }

  if (field === "title") {
    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }
  }

  const fallbackTitleCompare = left.title.localeCompare(right.title);
  if (fallbackTitleCompare !== 0) {
    return fallbackTitleCompare;
  }

  return left.id.localeCompare(right.id);
}

export function TaskPanel() {
  const tasks = useTodoStore((state) => state.tasks);
  const taskLogs = useTodoStore((state) => state.taskLogs);
  const addTask = useTodoStore((state) => state.addTask);
  const updateTask = useTodoStore((state) => state.updateTask);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const addTaskLog = useTodoStore((state) => state.addTaskLog);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(todayDateKey());
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("active");
  const [newTaskTags, setNewTaskTags] = useState("");
  const [taskDateFrom, setTaskDateFrom] = useState("");
  const [taskDateTo, setTaskDateTo] = useState("");
  const [taskSort, setTaskSort] = useState<{ field: TaskSortField; direction: SortDirection }>({
    field: "status",
    direction: "asc",
  });
  const [taskPage, setTaskPage] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState(todayDateKey());
  const [editStatus, setEditStatus] = useState<TaskStatus>("active");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [newLogType, setNewLogType] = useState<TaskLogType>("simple");
  const [newLogContent, setNewLogContent] = useState("");

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskDateFrom && task.executionDate < taskDateFrom) {
        return false;
      }
      if (taskDateTo && task.executionDate > taskDateTo) {
        return false;
      }
      return true;
    });
  }, [taskDateFrom, taskDateTo, tasks]);

  const sortedTasks = useMemo(() => {
    const directionMultiplier = taskSort.direction === "asc" ? 1 : -1;
    return [...filteredTasks].sort(
      (left, right) => compareByTaskField(left, right, taskSort.field) * directionMultiplier,
    );
  }, [filteredTasks, taskSort.direction, taskSort.field]);

  const taskTotalPages = Math.max(1, Math.ceil(sortedTasks.length / taskPageSize));
  const taskCurrentPage = Math.min(taskPage, taskTotalPages);
  const pagedTasks = useMemo(() => {
    const start = (taskCurrentPage - 1) * taskPageSize;
    return sortedTasks.slice(start, start + taskPageSize);
  }, [sortedTasks, taskCurrentPage]);

  useEffect(() => {
    setTaskPage(1);
  }, [taskDateFrom, taskDateTo, taskSort.direction, taskSort.field]);

  useEffect(() => {
    if (taskPage > taskTotalPages) {
      setTaskPage(taskTotalPages);
    }
  }, [taskPage, taskTotalPages]);

  useEffect(() => {
    if (!selectedTaskId || !sortedTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(sortedTasks[0]?.id ?? null);
    }
  }, [selectedTaskId, sortedTasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );

  useEffect(() => {
    if (!selectedTask) {
      setEditTitle("");
      setEditDate(todayDateKey());
      setEditStatus("active");
      setEditTagsInput("");
      return;
    }

    setEditTitle(selectedTask.title);
    setEditDate(selectedTask.executionDate);
    setEditStatus(selectedTask.status);
    setEditTagsInput((selectedTask.tags ?? []).join(", "));
  }, [selectedTask]);

  const relatedLogs = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    return taskLogs
      .filter((log) => log.taskId === selectedTask.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [taskLogs, selectedTask]);

  const onToggleTaskSort = (field: TaskSortField) => {
    setTaskSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: taskSortDefaultDirection[field],
      };
    });
  };

  const onSubmitCreateTask = (event: FormEvent) => {
    event.preventDefault();
    addTask({
      title: newTaskTitle,
      executionDate: newTaskDate,
      status: newTaskStatus,
      tags: normalizeTagsFromInput(newTaskTags),
    });
    setNewTaskTitle("");
    setNewTaskDate(todayDateKey());
    setNewTaskStatus("active");
    setNewTaskTags("");
  };

  const onSubmitTaskEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    updateTask(selectedTask.id, {
      title: editTitle,
      executionDate: editDate,
      status: editStatus,
      tags: normalizeTagsFromInput(editTagsInput),
    });
  };

  const onSubmitTaskLog = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    addTaskLog({
      taskId: selectedTask.id,
      type: newLogType,
      content: newLogContent,
    });
    setNewLogContent("");
  };

  const isSortActive = (field: TaskSortField) => taskSort.field === field;
  const sortDirectionText = (field: TaskSortField) =>
    isSortActive(field) ? (taskSort.direction === "asc" ? "ASC" : "DESC") : "";

  return (
    <section className="task-panel-layout" aria-label="Task management">
      <aside className="task-search-panel">
        <form className="task-create-form" onSubmit={onSubmitCreateTask}>
          <input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
            placeholder="Task title (required)"
            required
          />
          <input
            type="date"
            value={newTaskDate}
            onChange={(event) => setNewTaskDate(event.currentTarget.value)}
            required
          />
          <select value={newTaskStatus} onChange={(event) => setNewTaskStatus(event.currentTarget.value as TaskStatus)}>
            <option value="active">active</option>
            <option value="completed">completed</option>
          </select>
          <input
            value={newTaskTags}
            onChange={(event) => setNewTaskTags(event.currentTarget.value)}
            placeholder="Tags (optional, comma separated)"
          />
          <button type="submit">Create Task</button>
        </form>

        <div className="list-controls">
          <div className="list-controls-row">
            <label className="list-filter-field">
              <span>From</span>
              <input
                className="list-filter-input"
                type="date"
                value={taskDateFrom}
                onChange={(event) => setTaskDateFrom(event.currentTarget.value)}
              />
            </label>
            <label className="list-filter-field">
              <span>To</span>
              <input
                className="list-filter-input"
                type="date"
                value={taskDateTo}
                onChange={(event) => setTaskDateTo(event.currentTarget.value)}
              />
            </label>
            <button
              className="list-clear-button"
              onClick={() => {
                setTaskDateFrom("");
                setTaskDateTo("");
              }}
              type="button"
            >
              Clear
            </button>
          </div>

          <div className="list-controls-row">
            <button
              className={`sort-button${isSortActive("status") ? " is-active" : ""}`}
              onClick={() => onToggleTaskSort("status")}
              type="button"
            >
              <span>Sort: Status</span>
              <em className="sort-direction-indicator">{sortDirectionText("status")}</em>
            </button>
            <button
              className={`sort-button${isSortActive("executionDate") ? " is-active" : ""}`}
              onClick={() => onToggleTaskSort("executionDate")}
              type="button"
            >
              <span>Sort: Execution Date</span>
              <em className="sort-direction-indicator">{sortDirectionText("executionDate")}</em>
            </button>
            <button
              className={`sort-button${isSortActive("title") ? " is-active" : ""}`}
              onClick={() => onToggleTaskSort("title")}
              type="button"
            >
              <span>Sort: Title</span>
              <em className="sort-direction-indicator">{sortDirectionText("title")}</em>
            </button>
          </div>
        </div>

        <div className="task-search-list">
          {pagedTasks.length > 0 ? (
            pagedTasks.map((task) => (
              <button
                key={task.id}
                className={`task-search-item${selectedTaskId === task.id ? " is-active" : ""}`}
                onClick={() => setSelectedTaskId(task.id)}
                type="button"
              >
                <label className="task-search-check">
                  <input checked={task.status === "completed"} onChange={() => toggleTask(task.id)} type="checkbox" />
                </label>
                <div className="task-search-content">
                  <p>{task.title}</p>
                  <span>{task.executionDate}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="task-empty">No tasks match the current filter.</div>
          )}
        </div>

        <div className="list-pagination">
          <button
            className="list-pagination-button"
            onClick={() => setTaskPage((current) => Math.max(1, current - 1))}
            type="button"
            disabled={taskCurrentPage <= 1}
          >
            Prev
          </button>
          <span className="list-pagination-status">{`Page ${taskCurrentPage} / ${taskTotalPages}`}</span>
          <button
            className="list-pagination-button"
            onClick={() => setTaskPage((current) => Math.min(taskTotalPages, current + 1))}
            type="button"
            disabled={taskCurrentPage >= taskTotalPages}
          >
            Next
          </button>
        </div>
      </aside>

      <div className="task-detail-panel">
        {selectedTask ? (
          <>
            <header className="task-detail-header">
              <h3>{selectedTask.title}</h3>
              <span className={`task-detail-status is-${selectedTask.status}`}>{selectedTask.status}</span>
            </header>

            <form className="task-edit-form" onSubmit={onSubmitTaskEditor}>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.currentTarget.value)}
                placeholder="Task title"
              />
              <input type="date" value={editDate} onChange={(event) => setEditDate(event.currentTarget.value)} />
              <select value={editStatus} onChange={(event) => setEditStatus(event.currentTarget.value as TaskStatus)}>
                <option value="active">active</option>
                <option value="completed">completed</option>
              </select>
              <input
                value={editTagsInput}
                onChange={(event) => setEditTagsInput(event.currentTarget.value)}
                placeholder="Tags (comma separated)"
              />
              <button type="submit">Save Task</button>
            </form>

            <div className="task-detail-grid task-detail-grid-single">
              <section className="task-detail-card">
                <header className="task-detail-card-header">
                  <h4>Task Logs</h4>
                </header>
                <form className="task-log-form" onSubmit={onSubmitTaskLog}>
                  <select value={newLogType} onChange={(event) => setNewLogType(event.currentTarget.value as TaskLogType)}>
                    {taskLogTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    value={newLogContent}
                    onChange={(event) => setNewLogContent(event.currentTarget.value)}
                    placeholder="Write a task log..."
                  />
                  <button type="submit">Add Log</button>
                </form>
                <div className="task-detail-list">
                  {relatedLogs.length > 0 ? (
                    relatedLogs.map((log) => (
                      <article key={log.id} className="task-log-row">
                        <div className="task-log-row-top">
                          <span className={`global-log-type global-log-type-${log.type}`}>{log.type}</span>
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p>{log.content}</p>
                      </article>
                    ))
                  ) : (
                    <p className="task-detail-empty">No logs for this task.</p>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="task-empty">Select a task to view details.</div>
        )}
      </div>
    </section>
  );
}
