import { FormEvent, useMemo, useState } from "react";
import { getGlobalTasks, getLogsForGlobal, useTodoStore } from "../../shared/state/useTodoStore";
import type { LogType, TaskKind, TodoGlobal } from "../../shared/types/todo";

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString();
}

function GlobalCard({
  globalItem,
  active,
  onSelect,
}: {
  globalItem: TodoGlobal;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`global-card${active ? " is-active" : ""}`} onClick={onSelect} type="button">
      <div className="global-card-header">
        <h3 className="global-card-title">{globalItem.title}</h3>
        <span className={`global-status global-status-${globalItem.status}`}>{globalItem.status}</span>
      </div>
      <p className="global-card-meta">Updated {formatDateLabel(globalItem.updatedAt)}</p>
      {globalItem.description ? <p className="global-card-description">{globalItem.description}</p> : null}
    </button>
  );
}

export function GlobalPanel() {
  const globals = useTodoStore((state) => state.globals);
  const tasks = useTodoStore((state) => state.tasks);
  const logs = useTodoStore((state) => state.logs);
  const selectedGlobalId = useTodoStore((state) => state.selectedGlobalId);
  const selectGlobal = useTodoStore((state) => state.selectGlobal);
  const addGlobal = useTodoStore((state) => state.addGlobal);
  const updateGlobal = useTodoStore((state) => state.updateGlobal);
  const addTaskToGlobal = useTodoStore((state) => state.addTaskToGlobal);
  const toggleTask = useTodoStore((state) => state.toggleTask);
  const addLog = useTodoStore((state) => state.addLog);

  const [newGlobalTitle, setNewGlobalTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskKind, setNewTaskKind] = useState<TaskKind>("task");
  const [newLogType, setNewLogType] = useState<LogType>("simple");
  const [newLogContent, setNewLogContent] = useState("");
  const [newLogTaskId, setNewLogTaskId] = useState<string>("none");

  const selectedGlobal = useMemo(
    () => globals.find((globalItem) => globalItem.id === selectedGlobalId) ?? null,
    [globals, selectedGlobalId],
  );
  const globalTasks = useMemo(
    () => (selectedGlobal ? getGlobalTasks(tasks, selectedGlobal.id) : []),
    [selectedGlobal, tasks],
  );
  const globalLogs = useMemo(
    () => (selectedGlobal ? getLogsForGlobal(logs, tasks, selectedGlobal.id) : []),
    [logs, selectedGlobal, tasks],
  );

  const onSubmitGlobal = (event: FormEvent) => {
    event.preventDefault();
    addGlobal(newGlobalTitle);
    setNewGlobalTitle("");
  };

  const onSubmitTask = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGlobal) {
      return;
    }

    addTaskToGlobal(selectedGlobal.id, newTaskTitle, newTaskKind);
    setNewTaskTitle("");
  };

  const onSubmitLog = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGlobal) {
      return;
    }

    const taskId = newLogTaskId === "none" ? undefined : newLogTaskId;
    addLog({ type: newLogType, content: newLogContent, taskId });
    setNewLogContent("");
  };

  return (
    <section className="global-layout" aria-label="Global management">
      <aside className="global-list-panel">
        <form className="global-create-form" onSubmit={onSubmitGlobal}>
          <input
            className="global-create-input"
            onChange={(event) => setNewGlobalTitle(event.currentTarget.value)}
            placeholder="Add a global..."
            value={newGlobalTitle}
          />
          <button className="global-create-button" type="submit">
            Add
          </button>
        </form>

        <div className="global-list">
          {globals.map((globalItem) => (
            <GlobalCard
              key={globalItem.id}
              active={globalItem.id === selectedGlobal?.id}
              globalItem={globalItem}
              onSelect={() => selectGlobal(globalItem.id)}
            />
          ))}
        </div>
      </aside>

      <div className="global-detail-panel">
        {selectedGlobal ? (
          <>
            <div className="global-editor">
              <label className="global-field">
                <span>Title</span>
                <input
                  value={selectedGlobal.title}
                  onChange={(event) => updateGlobal(selectedGlobal.id, { title: event.currentTarget.value })}
                />
              </label>
              <label className="global-field">
                <span>Description</span>
                <textarea
                  rows={3}
                  value={selectedGlobal.description ?? ""}
                  onChange={(event) => updateGlobal(selectedGlobal.id, { description: event.currentTarget.value })}
                />
              </label>
              <label className="global-field">
                <span>Status</span>
                <select
                  value={selectedGlobal.status}
                  onChange={(event) =>
                    updateGlobal(selectedGlobal.id, { status: event.currentTarget.value as TodoGlobal["status"] })
                  }
                >
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="terminated">terminated</option>
                </select>
              </label>
            </div>

            <div className="global-related-grid">
              <section className="global-related-card" aria-label="Global tasks">
                <header className="global-related-header">
                  <h3>Tasks</h3>
                </header>
                <form className="global-inline-form" onSubmit={onSubmitTask}>
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
                    placeholder="Add task or delay..."
                  />
                  <select
                    value={newTaskKind}
                    onChange={(event) => setNewTaskKind(event.currentTarget.value as TaskKind)}
                  >
                    <option value="task">task</option>
                    <option value="delay">delay</option>
                  </select>
                  <button type="submit">Add</button>
                </form>
                <div className="global-items-list">
                  {globalTasks.map((task) => (
                    <label key={task.id} className="global-task-row">
                      <input checked={task.status === "completed"} onChange={() => toggleTask(task.id)} type="checkbox" />
                      <span className="global-task-title">{task.title}</span>
                      <span className={`global-task-kind global-task-kind-${task.kind}`}>{task.kind}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="global-related-card" aria-label="Global logs">
                <header className="global-related-header">
                  <h3>Logs</h3>
                </header>
                <form className="global-log-form" onSubmit={onSubmitLog}>
                  <select value={newLogType} onChange={(event) => setNewLogType(event.currentTarget.value as LogType)}>
                    <option value="simple">simple</option>
                    <option value="exception">exception</option>
                    <option value="spark">spark</option>
                    <option value="conclusion">conclusion</option>
                  </select>
                  <select value={newLogTaskId} onChange={(event) => setNewLogTaskId(event.currentTarget.value)}>
                    <option value="none">No linked task</option>
                    {globalTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={3}
                    value={newLogContent}
                    onChange={(event) => setNewLogContent(event.currentTarget.value)}
                    placeholder="Write a log..."
                  />
                  <button type="submit">Add Log</button>
                </form>

                <div className="global-items-list">
                  {globalLogs.map((log) => (
                    <article key={log.id} className="global-log-row">
                      <div className="global-log-row-top">
                        <span className={`global-log-type global-log-type-${log.type}`}>{log.type}</span>
                        <span>{formatDateLabel(log.createdAt)}</span>
                      </div>
                      <p>{log.content}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="global-empty">No global selected. Create one to start planning.</div>
        )}
      </div>
    </section>
  );
}
