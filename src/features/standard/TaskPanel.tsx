import { FormEvent, useEffect, useMemo, useState } from "react";
import { getVisibleTasks, useTodoStore } from "../../shared/state/useTodoStore";
import type { TaskLogType, TaskStatus, TodoTask } from "../../shared/types/todo";

const taskLogTypes: TaskLogType[] = ["simple", "progress", "exception", "conclusion"];

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

function taskDate(task: TodoTask) {
  return task.executionDate;
}

export function TaskPanel() {
  const tasks = useTodoStore((state) => state.tasks);
  const taskLogs = useTodoStore((state) => state.taskLogs);
  const sortMode = useTodoStore((state) => state.sortMode);
  const addTask = useTodoStore((state) => state.addTask);
  const updateTask = useTodoStore((state) => state.updateTask);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const addTaskLog = useTodoStore((state) => state.addTaskLog);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(todayDateKey());
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("active");
  const [newTaskTags, setNewTaskTags] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState(todayDateKey());
  const [editStatus, setEditStatus] = useState<TaskStatus>("active");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [newLogType, setNewLogType] = useState<TaskLogType>("simple");
  const [newLogContent, setNewLogContent] = useState("");

  const taskCandidates = useMemo(
    () => getVisibleTasks([...tasks], "all", sortMode),
    [sortMode, tasks],
  );

  const filteredTasks = useMemo(() => {
    if (!dateFilter) {
      return taskCandidates;
    }

    return taskCandidates.filter((task) => taskDate(task) === dateFilter);
  }, [dateFilter, taskCandidates]);

  useEffect(() => {
    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0]?.id ?? null);
    }
  }, [filteredTasks, selectedTaskId]);

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
          <input type="date" value={newTaskDate} onChange={(event) => setNewTaskDate(event.currentTarget.value)} required />
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

        <div className="task-search-header">
          <label htmlFor="task-date-filter">Execution Date</label>
          <input
            id="task-date-filter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.currentTarget.value)}
          />
          {dateFilter ? (
            <button className="task-clear-date" onClick={() => setDateFilter("")} type="button">
              Clear
            </button>
          ) : null}
        </div>

        <div className="task-search-list">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
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
            <div className="task-empty">No tasks found for selected date.</div>
          )}
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
