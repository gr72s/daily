import { FormEvent, useEffect, useMemo, useState } from "react";
import { getVisibleTasks, useTodoStore } from "../../shared/state/useTodoStore";
import type { LogType, TodoTask } from "../../shared/types/todo";

const logTypes: LogType[] = ["simple", "exception", "spark", "conclusion"];

function dateKey(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function taskDate(task: TodoTask) {
  return task.createdAt ?? task.closedAt;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export function TaskPanel() {
  const tasks = useTodoStore((state) => state.tasks);
  const logs = useTodoStore((state) => state.logs);
  const sortMode = useTodoStore((state) => state.sortMode);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const addDelayToTask = useTodoStore((state) => state.addDelayToTask);
  const addLog = useTodoStore((state) => state.addLog);

  const [dateFilter, setDateFilter] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [delayTitle, setDelayTitle] = useState("");
  const [logType, setLogType] = useState<LogType>("simple");
  const [logContent, setLogContent] = useState("");
  const [conclusionTaskId, setConclusionTaskId] = useState<string | null>(null);
  const [conclusionContent, setConclusionContent] = useState("");

  const taskCandidates = useMemo(
    () => getVisibleTasks([...tasks], "all", sortMode).filter((task) => task.kind === "task"),
    [sortMode, tasks],
  );

  const filteredTasks = useMemo(() => {
    if (!dateFilter) {
      return taskCandidates;
    }

    return taskCandidates.filter((task) => dateKey(taskDate(task)) === dateFilter);
  }, [dateFilter, taskCandidates]);

  useEffect(() => {
    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0]?.id ?? null);
    }
  }, [filteredTasks, selectedTaskId]);

  useEffect(() => {
    if (conclusionTaskId && !tasks.some((task) => task.id === conclusionTaskId)) {
      setConclusionTaskId(null);
      setConclusionContent("");
    }
  }, [conclusionTaskId, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId && task.kind === "task") ?? null,
    [selectedTaskId, tasks],
  );

  const relatedDelays = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    return tasks
      .filter((task) => task.kind === "delay" && task.parentTaskId === selectedTask.id)
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [selectedTask, tasks]);

  const relatedLogs = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    return logs
      .filter((log) => log.taskId === selectedTask.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [logs, selectedTask]);

  const onToggleTask = (task: TodoTask) => {
    const completing = task.status !== "completed";
    toggleTask(task.id);

    if (completing) {
      setSelectedTaskId(task.id);
      setConclusionTaskId(task.id);
      setConclusionContent("");
      setLogType("conclusion");
    } else if (conclusionTaskId === task.id) {
      setConclusionTaskId(null);
      setConclusionContent("");
    }
  };

  const onSubmitDelay = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    addDelayToTask(selectedTask.id, delayTitle);
    setDelayTitle("");
  };

  const onSubmitLog = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    addLog({
      taskId: selectedTask.id,
      type: logType,
      content: logContent,
    });
    setLogContent("");
  };

  const onSubmitConclusion = (event: FormEvent) => {
    event.preventDefault();
    if (!conclusionTaskId) {
      return;
    }

    addLog({
      taskId: conclusionTaskId,
      type: "conclusion",
      content: conclusionContent,
    });
    setConclusionTaskId(null);
    setConclusionContent("");
  };

  return (
    <section className="task-panel-layout" aria-label="Task search and relation">
      <aside className="task-search-panel">
        <div className="task-search-header">
          <label htmlFor="task-date-filter">Date</label>
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
                  <input checked={task.status === "completed"} onChange={() => onToggleTask(task)} type="checkbox" />
                </label>
                <div className="task-search-content">
                  <p>{task.title}</p>
                  <span>{formatDateTime(taskDate(task))}</span>
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

            {conclusionTaskId === selectedTask.id ? (
              <form className="task-conclusion-form" onSubmit={onSubmitConclusion}>
                <h4>Conclusion Mode</h4>
                <textarea
                  rows={3}
                  value={conclusionContent}
                  onChange={(event) => setConclusionContent(event.currentTarget.value)}
                  placeholder="Summarize outcome for this completed task..."
                />
                <div className="task-conclusion-actions">
                  <button type="submit">Save Conclusion</button>
                  <button
                    type="button"
                    onClick={() => {
                      setConclusionTaskId(null);
                      setConclusionContent("");
                    }}
                  >
                    Skip
                  </button>
                </div>
              </form>
            ) : null}

            <div className="task-detail-grid">
              <section className="task-detail-card">
                <header className="task-detail-card-header">
                  <h4>Delay Tasks</h4>
                </header>
                <form className="task-detail-inline-form" onSubmit={onSubmitDelay}>
                  <input
                    value={delayTitle}
                    onChange={(event) => setDelayTitle(event.currentTarget.value)}
                    placeholder="Add delay task..."
                  />
                  <button type="submit">Add</button>
                </form>
                <div className="task-detail-list">
                  {relatedDelays.length > 0 ? (
                    relatedDelays.map((delayTask) => (
                      <label key={delayTask.id} className="task-delay-row">
                        <input
                          checked={delayTask.status === "completed"}
                          onChange={() => toggleTask(delayTask.id)}
                          type="checkbox"
                        />
                        <span>{delayTask.title}</span>
                      </label>
                    ))
                  ) : (
                    <p className="task-detail-empty">No linked delay tasks.</p>
                  )}
                </div>
              </section>

              <section className="task-detail-card">
                <header className="task-detail-card-header">
                  <h4>Logs</h4>
                </header>
                <form className="task-log-form" onSubmit={onSubmitLog}>
                  <select value={logType} onChange={(event) => setLogType(event.currentTarget.value as LogType)}>
                    {logTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    value={logContent}
                    onChange={(event) => setLogContent(event.currentTarget.value)}
                    placeholder="Write a related log..."
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
                    <p className="task-detail-empty">No linked logs.</p>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="task-empty">Select a task to view related delay tasks and logs.</div>
        )}
      </div>
    </section>
  );
}
