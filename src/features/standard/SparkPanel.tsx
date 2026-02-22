import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTodoStore } from "../../shared/state/useTodoStore";

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString();
}

function getSelectedMultiValues(selectElement: HTMLSelectElement) {
  return Array.from(selectElement.selectedOptions).map((option) => option.value);
}

export function SparkPanel() {
  const sparks = useTodoStore((state) => state.sparks);
  const globals = useTodoStore((state) => state.globals);
  const tasks = useTodoStore((state) => state.tasks);
  const addSpark = useTodoStore((state) => state.addSpark);
  const updateSpark = useTodoStore((state) => state.updateSpark);

  const [newSparkTitle, setNewSparkTitle] = useState("");
  const [newSparkDescription, setNewSparkDescription] = useState("");
  const [newSparkGlobalIds, setNewSparkGlobalIds] = useState<string[]>([]);
  const [newSparkTaskIds, setNewSparkTaskIds] = useState<string[]>([]);
  const [selectedSparkId, setSelectedSparkId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGlobalIds, setEditGlobalIds] = useState<string[]>([]);
  const [editTaskIds, setEditTaskIds] = useState<string[]>([]);

  const selectedSpark = useMemo(
    () => sparks.find((spark) => spark.id === selectedSparkId) ?? null,
    [selectedSparkId, sparks],
  );

  useEffect(() => {
    if (!selectedSparkId || !sparks.some((spark) => spark.id === selectedSparkId)) {
      setSelectedSparkId(sparks[0]?.id ?? null);
    }
  }, [selectedSparkId, sparks]);

  useEffect(() => {
    if (!selectedSpark) {
      setEditTitle("");
      setEditDescription("");
      setEditGlobalIds([]);
      setEditTaskIds([]);
      return;
    }

    setEditTitle(selectedSpark.title);
    setEditDescription(selectedSpark.description ?? "");
    setEditGlobalIds(selectedSpark.globalIds ?? []);
    setEditTaskIds(selectedSpark.taskIds ?? []);
  }, [selectedSpark]);

  const onSubmitCreateSpark = (event: FormEvent) => {
    event.preventDefault();
    addSpark({
      title: newSparkTitle,
      description: newSparkDescription,
      globalIds: newSparkGlobalIds,
      taskIds: newSparkTaskIds,
    });
    setNewSparkTitle("");
    setNewSparkDescription("");
    setNewSparkGlobalIds([]);
    setNewSparkTaskIds([]);
  };

  const onSubmitEditSpark = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSpark) {
      return;
    }

    updateSpark(selectedSpark.id, {
      title: editTitle,
      description: editDescription,
      globalIds: editGlobalIds,
      taskIds: editTaskIds,
    });
  };

  return (
    <section className="spark-layout" aria-label="Spark management">
      <aside className="spark-list-panel">
        <form className="spark-form" onSubmit={onSubmitCreateSpark}>
          <input
            value={newSparkTitle}
            onChange={(event) => setNewSparkTitle(event.currentTarget.value)}
            placeholder="Spark title (required)"
            required
          />
          <textarea
            rows={3}
            value={newSparkDescription}
            onChange={(event) => setNewSparkDescription(event.currentTarget.value)}
            placeholder="Description (optional)"
          />
          <label>
            Linked Globals (optional)
            <select
              multiple
              value={newSparkGlobalIds}
              onChange={(event) => setNewSparkGlobalIds(getSelectedMultiValues(event.currentTarget))}
            >
              {globals.map((globalItem) => (
                <option key={globalItem.id} value={globalItem.id}>
                  {globalItem.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Linked Tasks (optional)
            <select
              multiple
              value={newSparkTaskIds}
              onChange={(event) => setNewSparkTaskIds(getSelectedMultiValues(event.currentTarget))}
            >
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Spark</button>
        </form>

        <div className="spark-list">
          {sparks.map((spark) => (
            <button
              key={spark.id}
              className={`spark-card${selectedSparkId === spark.id ? " is-active" : ""}`}
              onClick={() => setSelectedSparkId(spark.id)}
              type="button"
            >
              <div className="spark-card-header">
                <h3>{spark.title}</h3>
                <span>{formatDateLabel(spark.updatedAt)}</span>
              </div>
              {spark.description ? <p>{spark.description}</p> : <p className="spark-empty-field">No description</p>}
              <div className="spark-card-links">
                <span>{`globals: ${spark.globalIds?.length ?? 0}`}</span>
                <span>{`tasks: ${spark.taskIds?.length ?? 0}`}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div className="spark-detail-panel">
        {selectedSpark ? (
          <form className="spark-form spark-edit-form" onSubmit={onSubmitEditSpark}>
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.currentTarget.value)}
              placeholder="Spark title"
            />
            <textarea
              rows={4}
              value={editDescription}
              onChange={(event) => setEditDescription(event.currentTarget.value)}
              placeholder="Description (optional)"
            />
            <label>
              Linked Globals (optional)
              <select
                multiple
                value={editGlobalIds}
                onChange={(event) => setEditGlobalIds(getSelectedMultiValues(event.currentTarget))}
              >
                {globals.map((globalItem) => (
                  <option key={globalItem.id} value={globalItem.id}>
                    {globalItem.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Linked Tasks (optional)
              <select
                multiple
                value={editTaskIds}
                onChange={(event) => setEditTaskIds(getSelectedMultiValues(event.currentTarget))}
              >
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Save Spark</button>
          </form>
        ) : (
          <div className="global-empty">No spark selected. Create one to start.</div>
        )}
      </div>
    </section>
  );
}
