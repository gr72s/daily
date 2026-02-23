import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTodoStore } from "../../shared/state/useTodoStore";
import type { GlobalStatus, TodoGlobal } from "../../shared/types/todo";

type SortDirection = "asc" | "desc";
type GlobalSortField = "status" | "startDate" | "title";

const globalStatusRank: Record<GlobalStatus, number> = {
  active: 0,
  completed: 1,
  terminated: 2,
};

const globalSortDefaultDirection: Record<GlobalSortField, SortDirection> = {
  status: "asc",
  startDate: "desc",
  title: "asc",
};

const globalPageSize = 10;

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleString();
}

function compareByGlobalField(left: TodoGlobal, right: TodoGlobal, field: GlobalSortField) {
  if (field === "status") {
    const statusCompare = globalStatusRank[left.status] - globalStatusRank[right.status];
    if (statusCompare !== 0) {
      return statusCompare;
    }
  }

  if (field === "startDate") {
    const dateCompare = left.startDate.localeCompare(right.startDate);
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
      <p className="global-card-meta">{`Start ${globalItem.startDate}`}</p>
      <p className="global-card-meta">{`Updated ${formatDateLabel(globalItem.updatedAt)}`}</p>
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
  const [showCreateDatePicker, setShowCreateDatePicker] = useState(false);
  const [showCreateStatusPicker, setShowCreateStatusPicker] = useState(false);
  const [showCreateDescriptionInput, setShowCreateDescriptionInput] = useState(false);
  const [globalDateFrom, setGlobalDateFrom] = useState("");
  const [globalDateTo, setGlobalDateTo] = useState("");
  const [globalSort, setGlobalSort] = useState<{ field: GlobalSortField; direction: SortDirection }>({
    field: "status",
    direction: "asc",
  });
  const [globalPage, setGlobalPage] = useState(1);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<GlobalStatus>("active");
  const [editStartDate, setEditStartDate] = useState(todayDateKey());

  const dateControlRef = useRef<HTMLDivElement | null>(null);
  const statusControlRef = useRef<HTMLDivElement | null>(null);
  const descriptionInputRef = useRef<HTMLInputElement | null>(null);

  const filteredGlobals = useMemo(() => {
    return globals.filter((globalItem) => {
      if (globalDateFrom && globalItem.startDate < globalDateFrom) {
        return false;
      }
      if (globalDateTo && globalItem.startDate > globalDateTo) {
        return false;
      }
      return true;
    });
  }, [globalDateFrom, globalDateTo, globals]);

  const sortedGlobals = useMemo(() => {
    const directionMultiplier = globalSort.direction === "asc" ? 1 : -1;
    return [...filteredGlobals].sort(
      (left, right) => compareByGlobalField(left, right, globalSort.field) * directionMultiplier,
    );
  }, [filteredGlobals, globalSort.direction, globalSort.field]);

  const globalTotalPages = Math.max(1, Math.ceil(sortedGlobals.length / globalPageSize));
  const globalCurrentPage = Math.min(globalPage, globalTotalPages);
  const pagedGlobals = useMemo(() => {
    const start = (globalCurrentPage - 1) * globalPageSize;
    return sortedGlobals.slice(start, start + globalPageSize);
  }, [globalCurrentPage, sortedGlobals]);

  const selectedGlobal = useMemo(
    () => globals.find((globalItem) => globalItem.id === selectedGlobalId) ?? null,
    [globals, selectedGlobalId],
  );
  const hasCreateDescription = newGlobalDescription.trim().length > 0;

  useEffect(() => {
    setGlobalPage(1);
  }, [globalDateFrom, globalDateTo, globalSort.direction, globalSort.field]);

  useEffect(() => {
    if (globalPage > globalTotalPages) {
      setGlobalPage(globalTotalPages);
    }
  }, [globalPage, globalTotalPages]);

  useEffect(() => {
    if (sortedGlobals.length === 0) {
      if (selectedGlobalId !== null) {
        selectGlobal(null);
      }
      return;
    }

    if (!selectedGlobal || !sortedGlobals.some((globalItem) => globalItem.id === selectedGlobal.id)) {
      selectGlobal(sortedGlobals[0].id);
    }
  }, [selectGlobal, selectedGlobal, selectedGlobalId, sortedGlobals]);

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

  useEffect(() => {
    if (!showCreateDescriptionInput) {
      return;
    }

    const timer = window.setTimeout(() => {
      descriptionInputRef.current?.focus();
      descriptionInputRef.current?.setSelectionRange(newGlobalDescription.length, newGlobalDescription.length);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [newGlobalDescription.length, showCreateDescriptionInput]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (showCreateDatePicker && dateControlRef.current && !dateControlRef.current.contains(target)) {
        setShowCreateDatePicker(false);
      }

      if (showCreateStatusPicker && statusControlRef.current && !statusControlRef.current.contains(target)) {
        setShowCreateStatusPicker(false);
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [showCreateDatePicker, showCreateStatusPicker]);

  const onToggleGlobalSort = (field: GlobalSortField) => {
    setGlobalSort((current) => {
      if (current.field === field) {
        return {
          field,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        field,
        direction: globalSortDefaultDirection[field],
      };
    });
  };

  const finalizeCreateDescription = () => {
    const trimmed = newGlobalDescription.trim();
    if (!trimmed) {
      setNewGlobalDescription("");
      setShowCreateDescriptionInput(false);
      return;
    }

    setNewGlobalDescription(trimmed);
    setShowCreateDescriptionInput(false);
  };

  const onCreateDescriptionKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    finalizeCreateDescription();
  };

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
    setShowCreateDatePicker(false);
    setShowCreateStatusPicker(false);
    setShowCreateDescriptionInput(false);
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

  const isSortActive = (field: GlobalSortField) => globalSort.field === field;
  const sortDirectionText = (field: GlobalSortField) =>
    isSortActive(field) ? (globalSort.direction === "asc" ? "ASC" : "DESC") : "";

  return (
    <section className="global-layout" aria-label="Global management">
      <form className="global-create-toolbar" onSubmit={onSubmitGlobal}>
        <div className="global-create-primary-row">
          <input
            className="global-create-title-input"
            onChange={(event) => setNewGlobalTitle(event.currentTarget.value)}
            placeholder="Global title (required)"
            value={newGlobalTitle}
            required
          />

          <div className="global-create-action-group">
            <div className="global-create-popover-control" ref={dateControlRef}>
              <button
                className={`global-create-icon-button${showCreateDatePicker ? " is-active" : ""}`}
                onClick={() => {
                  setShowCreateDatePicker((current) => !current);
                  setShowCreateStatusPicker(false);
                }}
                type="button"
                aria-label="Set start date"
              >
                📅
              </button>
              {showCreateDatePicker ? (
                <div className="global-create-popover">
                  <input
                    className="global-create-popover-input"
                    type="date"
                    value={newGlobalStartDate}
                    onChange={(event) => {
                      setNewGlobalStartDate(event.currentTarget.value);
                      setShowCreateDatePicker(false);
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="global-create-popover-control" ref={statusControlRef}>
              <button
                className={`global-create-icon-button${showCreateStatusPicker ? " is-active" : ""}`}
                onClick={() => {
                  setShowCreateStatusPicker((current) => !current);
                  setShowCreateDatePicker(false);
                }}
                type="button"
                aria-label="Set status"
              >
                ◎
              </button>
              {showCreateStatusPicker ? (
                <div className="global-create-popover global-create-status-popover">
                  {(["active", "completed", "terminated"] as const).map((status) => (
                    <button
                      key={status}
                      className={`global-create-status-option${newGlobalStatus === status ? " is-selected" : ""}`}
                      onClick={() => {
                        setNewGlobalStatus(status);
                        setShowCreateStatusPicker(false);
                      }}
                      type="button"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              className={`global-create-icon-button${showCreateDescriptionInput || hasCreateDescription ? " is-active" : ""}`}
              onClick={() => setShowCreateDescriptionInput(true)}
              type="button"
              aria-label="Set description"
            >
              ✎
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
            value={newGlobalDescription}
            onChange={(event) => setNewGlobalDescription(event.currentTarget.value)}
            onBlur={finalizeCreateDescription}
            onKeyDown={onCreateDescriptionKeyDown}
            placeholder="Description (optional)"
          />
        ) : null}
      </form>

      <section className="global-list-panel" aria-label="Existing globals">
        <div className="list-controls">
          <div className="list-controls-row">
            <label className="list-filter-field">
              <span>From</span>
              <input
                className="list-filter-input"
                type="date"
                value={globalDateFrom}
                onChange={(event) => setGlobalDateFrom(event.currentTarget.value)}
              />
            </label>
            <label className="list-filter-field">
              <span>To</span>
              <input
                className="list-filter-input"
                type="date"
                value={globalDateTo}
                onChange={(event) => setGlobalDateTo(event.currentTarget.value)}
              />
            </label>
            <button
              className="list-clear-button"
              onClick={() => {
                setGlobalDateFrom("");
                setGlobalDateTo("");
              }}
              type="button"
            >
              Clear
            </button>
          </div>

          <div className="list-controls-row">
            <button
              className={`sort-button${isSortActive("status") ? " is-active" : ""}`}
              onClick={() => onToggleGlobalSort("status")}
              type="button"
            >
              <span>Sort: Status</span>
              <em className="sort-direction-indicator">{sortDirectionText("status")}</em>
            </button>
            <button
              className={`sort-button${isSortActive("startDate") ? " is-active" : ""}`}
              onClick={() => onToggleGlobalSort("startDate")}
              type="button"
            >
              <span>Sort: Start Date</span>
              <em className="sort-direction-indicator">{sortDirectionText("startDate")}</em>
            </button>
            <button
              className={`sort-button${isSortActive("title") ? " is-active" : ""}`}
              onClick={() => onToggleGlobalSort("title")}
              type="button"
            >
              <span>Sort: Title</span>
              <em className="sort-direction-indicator">{sortDirectionText("title")}</em>
            </button>
          </div>
        </div>

        <div className="global-list">
          {pagedGlobals.length > 0 ? (
            pagedGlobals.map((globalItem) => (
              <GlobalCard
                key={globalItem.id}
                active={globalItem.id === selectedGlobal?.id}
                globalItem={globalItem}
                onSelect={() => selectGlobal(globalItem.id)}
              />
            ))
          ) : (
            <div className="task-empty">No globals match the current filter.</div>
          )}
        </div>

        <div className="list-pagination">
          <button
            className="list-pagination-button"
            onClick={() => setGlobalPage((current) => Math.max(1, current - 1))}
            type="button"
            disabled={globalCurrentPage <= 1}
          >
            Prev
          </button>
          <span className="list-pagination-status">{`Page ${globalCurrentPage} / ${globalTotalPages}`}</span>
          <button
            className="list-pagination-button"
            onClick={() => setGlobalPage((current) => Math.min(globalTotalPages, current + 1))}
            type="button"
            disabled={globalCurrentPage >= globalTotalPages}
          >
            Next
          </button>
        </div>
      </section>

      <section className="global-detail-panel" aria-label="Global detail">
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
      </section>
    </section>
  );
}
