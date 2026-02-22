import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTodoStore } from "../../shared/state/useTodoStore";
import type { GlobalStatus, TodoGlobal } from "../../shared/types/todo";

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

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
      <p className="global-card-meta">Start {globalItem.startDate}</p>
      <p className="global-card-meta">Updated {formatDateLabel(globalItem.updatedAt)}</p>
      {globalItem.description ? <p className="global-card-description">{globalItem.description}</p> : null}
    </button>
  );
}

export function GlobalPanel() {
  const globals = useTodoStore((state) => state.globals);
  const selectedGlobalId = useTodoStore((state) => state.selectedGlobalId);
  const selectGlobal = useTodoStore((state) => state.selectGlobal);
  const addGlobal = useTodoStore((state) => state.addGlobal);
  const updateGlobal = useTodoStore((state) => state.updateGlobal);

  const [newGlobalTitle, setNewGlobalTitle] = useState("");
  const [newGlobalDescription, setNewGlobalDescription] = useState("");
  const [newGlobalStatus, setNewGlobalStatus] = useState<GlobalStatus>("active");
  const [newGlobalStartDate, setNewGlobalStartDate] = useState(todayDateKey());
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<GlobalStatus>("active");
  const [editStartDate, setEditStartDate] = useState(todayDateKey());

  const selectedGlobal = useMemo(
    () => globals.find((globalItem) => globalItem.id === selectedGlobalId) ?? null,
    [globals, selectedGlobalId],
  );

  useEffect(() => {
    if (!selectedGlobal && globals.length > 0) {
      selectGlobal(globals[0].id);
    }
  }, [globals, selectedGlobal, selectGlobal]);

  useEffect(() => {
    if (!selectedGlobal) {
      setEditTitle("");
      setEditDescription("");
      setEditStatus("active");
      setEditStartDate(todayDateKey());
      return;
    }

    setEditTitle(selectedGlobal.title);
    setEditDescription(selectedGlobal.description ?? "");
    setEditStatus(selectedGlobal.status);
    setEditStartDate(selectedGlobal.startDate);
  }, [selectedGlobal]);

  const onSubmitGlobal = (event: FormEvent) => {
    event.preventDefault();
    addGlobal({
      title: newGlobalTitle,
      description: newGlobalDescription,
      status: newGlobalStatus,
      startDate: newGlobalStartDate,
    });
    setNewGlobalTitle("");
    setNewGlobalDescription("");
    setNewGlobalStatus("active");
    setNewGlobalStartDate(todayDateKey());
  };

  const onSubmitEditor = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedGlobal) {
      return;
    }

    updateGlobal(selectedGlobal.id, {
      title: editTitle,
      description: editDescription,
      status: editStatus,
      startDate: editStartDate,
    });
  };

  return (
    <section className="global-layout" aria-label="Global management">
      <aside className="global-list-panel">
        <form className="global-create-form" onSubmit={onSubmitGlobal}>
          <input
            className="global-create-input"
            onChange={(event) => setNewGlobalTitle(event.currentTarget.value)}
            placeholder="Global title (required)"
            value={newGlobalTitle}
            required
          />
          <input
            className="global-create-input"
            type="date"
            value={newGlobalStartDate}
            onChange={(event) => setNewGlobalStartDate(event.currentTarget.value)}
            required
          />
          <select
            className="global-create-input"
            value={newGlobalStatus}
            onChange={(event) => setNewGlobalStatus(event.currentTarget.value as GlobalStatus)}
          >
            <option value="active">active</option>
            <option value="completed">completed</option>
            <option value="terminated">terminated</option>
          </select>
          <textarea
            className="global-create-input"
            rows={3}
            value={newGlobalDescription}
            onChange={(event) => setNewGlobalDescription(event.currentTarget.value)}
            placeholder="Description (optional)"
          />
          <button className="global-create-button" type="submit">
            Create Global
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
          <form className="global-editor global-editor-single" onSubmit={onSubmitEditor}>
            <label className="global-field">
              <span>Title</span>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.currentTarget.value)}
                placeholder="Global title"
              />
            </label>
            <label className="global-field">
              <span>Start Date</span>
              <input
                type="date"
                value={editStartDate}
                onChange={(event) => setEditStartDate(event.currentTarget.value)}
              />
            </label>
            <label className="global-field">
              <span>Status</span>
              <select
                value={editStatus}
                onChange={(event) => setEditStatus(event.currentTarget.value as GlobalStatus)}
              >
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="terminated">terminated</option>
              </select>
            </label>
            <label className="global-field global-field-full">
              <span>Description</span>
              <textarea
                rows={5}
                value={editDescription}
                onChange={(event) => setEditDescription(event.currentTarget.value)}
                placeholder="Description (optional)"
              />
            </label>
            <div className="global-editor-actions">
              <button className="global-create-button" type="submit">
                Save Global
              </button>
            </div>
          </form>
        ) : (
          <div className="global-empty">No global selected. Create one to start.</div>
        )}
      </div>
    </section>
  );
}
