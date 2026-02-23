import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTodoStore } from "../../shared/state/useTodoStore";
import type { TodoSpark } from "../../shared/types/todo";
import { DateRangeFilter, EntityLayout, ListControls, ListPagination } from "./shared/EntityLayoutBlocks";

type SortDirection = "asc" | "desc";
type SparkSortField = "title" | "createdAt" | "updatedAt";

const sparkSortDefaultDirection: Record<SparkSortField, SortDirection> = {
  title: "asc",
  createdAt: "desc",
  updatedAt: "desc",
};
const sparkPageSize = 10;

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString();
}

function getSelectedMultiValues(selectElement: HTMLSelectElement) {
  return Array.from(selectElement.selectedOptions).map((option) => option.value);
}

function dateKeyFromIso(iso: string) {
  return iso.slice(0, 10);
}

function compareBySparkField(left: TodoSpark, right: TodoSpark, field: SparkSortField) {
  if (field === "title") {
    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) {
      return titleCompare;
    }
  }

  if (field === "createdAt") {
    const createdCompare = left.createdAt.localeCompare(right.createdAt);
    if (createdCompare !== 0) {
      return createdCompare;
    }
  }

  if (field === "updatedAt") {
    const updatedCompare = left.updatedAt.localeCompare(right.updatedAt);
    if (updatedCompare !== 0) {
      return updatedCompare;
    }
  }

  const fallbackTitleCompare = left.title.localeCompare(right.title);
  if (fallbackTitleCompare !== 0) {
    return fallbackTitleCompare;
  }
  return left.id.localeCompare(right.id);
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
  const [showCreateGlobalPicker, setShowCreateGlobalPicker] = useState(false);
  const [showCreateTaskPicker, setShowCreateTaskPicker] = useState(false);
  const [showCreateDescriptionInput, setShowCreateDescriptionInput] = useState(false);
  const [sparkDateFrom, setSparkDateFrom] = useState("");
  const [sparkDateTo, setSparkDateTo] = useState("");
  const [sparkSort, setSparkSort] = useState<{ field: SparkSortField; direction: SortDirection }>({
    field: "createdAt",
    direction: "desc",
  });
  const [sparkPage, setSparkPage] = useState(1);
  const [selectedSparkId, setSelectedSparkId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editGlobalIds, setEditGlobalIds] = useState<string[]>([]);
  const [editTaskIds, setEditTaskIds] = useState<string[]>([]);

  const globalControlRef = useRef<HTMLDivElement | null>(null);
  const taskControlRef = useRef<HTMLDivElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement | null>(null);

  const filteredSparks = useMemo(() => {
    return sparks.filter((spark) => {
      const createdAtDate = dateKeyFromIso(spark.createdAt);
      if (sparkDateFrom && createdAtDate < sparkDateFrom) {
        return false;
      }
      if (sparkDateTo && createdAtDate > sparkDateTo) {
        return false;
      }
      return true;
    });
  }, [sparkDateFrom, sparkDateTo, sparks]);

  const sortedSparks = useMemo(() => {
    const directionMultiplier = sparkSort.direction === "asc" ? 1 : -1;
    return [...filteredSparks].sort(
      (left, right) => compareBySparkField(left, right, sparkSort.field) * directionMultiplier,
    );
  }, [filteredSparks, sparkSort.direction, sparkSort.field]);

  const sparkTotalPages = Math.max(1, Math.ceil(sortedSparks.length / sparkPageSize));
  const sparkCurrentPage = Math.min(sparkPage, sparkTotalPages);
  const pagedSparks = useMemo(() => {
    const start = (sparkCurrentPage - 1) * sparkPageSize;
    return sortedSparks.slice(start, start + sparkPageSize);
  }, [sortedSparks, sparkCurrentPage]);

  const selectedSpark = useMemo(
    () => sparks.find((spark) => spark.id === selectedSparkId) ?? null,
    [selectedSparkId, sparks],
  );
  const isSparkDateRangeInvalid = Boolean(sparkDateFrom && sparkDateTo && sparkDateFrom > sparkDateTo);
  const hasCreateDescription = newSparkDescription.trim().length > 0;

  useEffect(() => {
    setSparkPage(1);
  }, [sparkDateFrom, sparkDateTo, sparkSort.direction, sparkSort.field]);

  useEffect(() => {
    if (sparkPage > sparkTotalPages) {
      setSparkPage(sparkTotalPages);
    }
  }, [sparkPage, sparkTotalPages]);

  useEffect(() => {
    if (!selectedSparkId || !sortedSparks.some((spark) => spark.id === selectedSparkId)) {
      setSelectedSparkId(sortedSparks[0]?.id ?? null);
    }
  }, [selectedSparkId, sortedSparks]);

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

  useEffect(() => {
    if (!showCreateDescriptionInput) {
      return;
    }

    const timer = window.setTimeout(() => {
      descriptionInputRef.current?.focus();
      descriptionInputRef.current?.setSelectionRange(newSparkDescription.length, newSparkDescription.length);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [newSparkDescription.length, showCreateDescriptionInput]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showCreateGlobalPicker && globalControlRef.current && !globalControlRef.current.contains(target)) {
        setShowCreateGlobalPicker(false);
      }

      if (showCreateTaskPicker && taskControlRef.current && !taskControlRef.current.contains(target)) {
        setShowCreateTaskPicker(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [showCreateGlobalPicker, showCreateTaskPicker]);

  const onToggleSparkSort = (field: SparkSortField) => {
    setSparkSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: sparkSortDefaultDirection[field],
      };
    });
  };

  const onResetSparkSort = () => {
    setSparkSort({
      field: "createdAt",
      direction: "desc",
    });
  };

  const finalizeCreateDescription = () => {
    const trimmed = newSparkDescription.trim();
    if (!trimmed) {
      setNewSparkDescription("");
      setShowCreateDescriptionInput(false);
      return;
    }

    setNewSparkDescription(trimmed);
    setShowCreateDescriptionInput(false);
  };

  const onCreateDescriptionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    finalizeCreateDescription();
  };

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
    setShowCreateGlobalPicker(false);
    setShowCreateTaskPicker(false);
    setShowCreateDescriptionInput(false);
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

  const isSortActive = (field: SparkSortField) => sparkSort.field === field;
  const sortDirectionText = (field: SparkSortField) =>
    isSortActive(field) ? (sparkSort.direction === "asc" ? "ASC" : "DESC") : "";

  return (
    <EntityLayout ariaLabel="Spark management">
      <form className="global-create-toolbar spark-create-toolbar" onSubmit={onSubmitCreateSpark}>
        <div className="global-create-primary-row">
          <input
            className="global-create-title-input"
            value={newSparkTitle}
            onChange={(event) => setNewSparkTitle(event.currentTarget.value)}
            placeholder="Spark title (required)"
            required
          />

          <div className="global-create-action-group">
            <div className="global-create-popover-control" ref={globalControlRef}>
              <button
                className={`global-create-icon-button${showCreateGlobalPicker ? " is-active" : ""}`}
                onClick={() => {
                  setShowCreateGlobalPicker((current) => !current);
                  setShowCreateTaskPicker(false);
                }}
                type="button"
                aria-label="Link globals"
              >
                G
              </button>
              {showCreateGlobalPicker ? (
                <div className="global-create-popover spark-create-link-popover">
                  <select
                    className="spark-create-multi-select"
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
                </div>
              ) : null}
            </div>

            <div className="global-create-popover-control" ref={taskControlRef}>
              <button
                className={`global-create-icon-button${showCreateTaskPicker ? " is-active" : ""}`}
                onClick={() => {
                  setShowCreateTaskPicker((current) => !current);
                  setShowCreateGlobalPicker(false);
                }}
                type="button"
                aria-label="Link tasks"
              >
                T
              </button>
              {showCreateTaskPicker ? (
                <div className="global-create-popover spark-create-link-popover">
                  <select
                    className="spark-create-multi-select"
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
                </div>
              ) : null}
            </div>

            <button
              className={`global-create-icon-button${showCreateDescriptionInput || hasCreateDescription ? " is-active" : ""}`}
              onClick={() => setShowCreateDescriptionInput(true)}
              type="button"
              aria-label="Set description"
            >
              M
            </button>
          </div>

          <button className="global-create-button" type="submit">
            Create
          </button>
        </div>

        {showCreateDescriptionInput ? (
          <input
            ref={descriptionInputRef}
            className="global-create-description-input"
            value={newSparkDescription}
            onChange={(event) => setNewSparkDescription(event.currentTarget.value)}
            onBlur={finalizeCreateDescription}
            onKeyDown={onCreateDescriptionKeyDown}
            placeholder="Description (optional)"
          />
        ) : null}
      </form>

      <section className="global-list-panel spark-list-panel" aria-label="Existing sparks">
        <ListControls
          filter={
            <DateRangeFilter
              from={sparkDateFrom}
              to={sparkDateTo}
              invalid={isSparkDateRangeInvalid}
              onFromChange={setSparkDateFrom}
              onToChange={setSparkDateTo}
              onClear={() => {
                setSparkDateFrom("");
                setSparkDateTo("");
              }}
            />
          }
          sort={
            <>
              <button
                className={`sort-button${isSortActive("createdAt") ? " is-active" : ""}`}
                onClick={() => onToggleSparkSort("createdAt")}
                type="button"
              >
                <span>Sort: Created</span>
                <em className="sort-direction-indicator">{sortDirectionText("createdAt")}</em>
              </button>
              <button
                className={`sort-button${isSortActive("updatedAt") ? " is-active" : ""}`}
                onClick={() => onToggleSparkSort("updatedAt")}
                type="button"
              >
                <span>Sort: Updated</span>
                <em className="sort-direction-indicator">{sortDirectionText("updatedAt")}</em>
              </button>
              <button
                className={`sort-button${isSortActive("title") ? " is-active" : ""}`}
                onClick={() => onToggleSparkSort("title")}
                type="button"
              >
                <span>Sort: Title</span>
                <em className="sort-direction-indicator">{sortDirectionText("title")}</em>
              </button>
              <button className="list-clear-button" onClick={onResetSparkSort} type="button">
                Clear
              </button>
            </>
          }
        />

        <div className="spark-list global-list">
          {pagedSparks.length > 0 ? (
            pagedSparks.map((spark) => (
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
                <p className="spark-card-meta">{`Created ${dateKeyFromIso(spark.createdAt)}`}</p>
                {spark.description ? <p>{spark.description}</p> : <p className="spark-empty-field">No description</p>}
                <div className="spark-card-links">
                  <span>{`globals: ${spark.globalIds?.length ?? 0}`}</span>
                  <span>{`tasks: ${spark.taskIds?.length ?? 0}`}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="task-empty">No sparks match the current filter.</div>
          )}
        </div>

        <ListPagination
          currentPage={sparkCurrentPage}
          totalPages={sparkTotalPages}
          onPrev={() => setSparkPage((current) => Math.max(1, current - 1))}
          onNext={() => setSparkPage((current) => Math.min(sparkTotalPages, current + 1))}
        />
      </section>

      <section className="global-detail-panel spark-detail-panel-compact" aria-label="Spark detail">
        {selectedSpark ? (
          <form className="global-editor global-editor-compact spark-editor-form" onSubmit={onSubmitEditSpark}>
            <label className="global-field global-field-wide">
              <span>Title</span>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.currentTarget.value)}
                placeholder="Spark title"
              />
            </label>
            <div className="spark-save-inline">
              <button className="global-create-button" type="submit">
                Save Spark
              </button>
            </div>

            <label className="global-field global-field-full spark-description-field">
              <span>Description</span>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(event) => setEditDescription(event.currentTarget.value)}
                placeholder="Description (optional)"
              />
            </label>

            <label className="global-field global-field-full">
              <span>Linked Globals (optional)</span>
              <select
                className="spark-detail-multi-select"
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

            <label className="global-field global-field-full">
              <span>Linked Tasks (optional)</span>
              <select
                className="spark-detail-multi-select"
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
          </form>
        ) : (
          <div className="global-empty">No spark selected. Create one to start.</div>
        )}
      </section>
    </EntityLayout>
  );
}
