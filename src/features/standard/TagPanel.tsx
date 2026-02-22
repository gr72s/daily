import { FormEvent, useEffect, useMemo, useState } from "react";
import { getVisibleTasks, useTodoStore } from "../../shared/state/useTodoStore";
import type { TodoTask } from "../../shared/types/todo";

function normalizeTagLabel(value: string) {
  return value.trim();
}

function getTaskTags(task: TodoTask) {
  return (task.tags ?? []).map((tag) => normalizeTagLabel(tag)).filter(Boolean);
}

export function TagPanel() {
  const tasks = useTodoStore((state) => state.tasks);
  const sortMode = useTodoStore((state) => state.sortMode);
  const addTaskTag = useTodoStore((state) => state.addTaskTag);
  const removeTaskTag = useTodoStore((state) => state.removeTaskTag);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTagValue, setNewTagValue] = useState("");

  const sortedTasks = useMemo(() => getVisibleTasks([...tasks], "all", sortMode), [tasks, sortMode]);

  const tagsWithCount = useMemo(() => {
    const counter = new Map<string, number>();
    for (const task of sortedTasks) {
      for (const tag of getTaskTags(task)) {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      }
    }

    return [...counter.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.tag.localeCompare(right.tag);
      });
  }, [sortedTasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedTag) {
      return sortedTasks;
    }

    return sortedTasks.filter((task) => getTaskTags(task).includes(selectedTag));
  }, [selectedTag, sortedTasks]);

  useEffect(() => {
    if (selectedTag && !tagsWithCount.some((item) => item.tag === selectedTag)) {
      setSelectedTag(null);
    }
  }, [selectedTag, tagsWithCount]);

  useEffect(() => {
    if (!selectedTaskId || !filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(filteredTasks[0]?.id ?? null);
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId],
  );

  const onSubmitAddTag = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      return;
    }

    const normalizedTag = normalizeTagLabel(newTagValue);
    if (!normalizedTag) {
      return;
    }

    addTaskTag(selectedTask.id, normalizedTag);
    setNewTagValue("");
  };

  const onToggleTagFilter = (tag: string) => {
    setSelectedTag((current) => (current === tag ? null : tag));
  };

  return (
    <section className="tag-layout" aria-label="Tag management">
      <aside className="tag-sidebar">
        <header className="tag-sidebar-header">
          <h3>Tags</h3>
          {selectedTag ? (
            <button className="tag-clear-filter" onClick={() => setSelectedTag(null)} type="button">
              Clear
            </button>
          ) : null}
        </header>

        <div className="tag-cloud">
          {tagsWithCount.length > 0 ? (
            tagsWithCount.map((item) => (
              <button
                key={item.tag}
                className={`tag-chip${selectedTag === item.tag ? " is-active" : ""}`}
                onClick={() => onToggleTagFilter(item.tag)}
                type="button"
              >
                <span>{item.tag}</span>
                <em>{item.count}</em>
              </button>
            ))
          ) : (
            <p className="tag-empty">No tags yet. Select a task and add one.</p>
          )}
        </div>
      </aside>

      <div className="tag-main">
        <header className="tag-main-header">
          <h3>{selectedTag ? `Tasks tagged: ${selectedTag}` : "All Tasks"}</h3>
          <span>{filteredTasks.length} items</span>
        </header>

        <div className="tag-task-list" role="listbox" aria-label="Tasks for tags">
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const taskTags = getTaskTags(task);

              return (
                <button
                  key={task.id}
                  className={`tag-task-card${selectedTaskId === task.id ? " is-active" : ""}`}
                  onClick={() => setSelectedTaskId(task.id)}
                  type="button"
                >
                  <p className="tag-task-title">{task.title}</p>
                  <div className="tag-task-tags">
                    {taskTags.length > 0 ? (
                      taskTags.map((tag) => (
                        <span key={`${task.id}-${tag}`} className="tag-task-chip">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="tag-task-empty">No tags</span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="tag-empty">No tasks match this tag filter.</div>
          )}
        </div>

        <section className="tag-editor" aria-label="Edit task tags">
          {selectedTask ? (
            <>
              <h4>{selectedTask.title}</h4>
              <form className="tag-editor-form" onSubmit={onSubmitAddTag}>
                <input
                  value={newTagValue}
                  onChange={(event) => setNewTagValue(event.currentTarget.value)}
                  placeholder="Add tag..."
                />
                <button type="submit">Add Tag</button>
              </form>

              <div className="tag-editor-list">
                {getTaskTags(selectedTask).length > 0 ? (
                  getTaskTags(selectedTask).map((tag) => (
                    <button
                      key={`${selectedTask.id}-${tag}-remove`}
                      className="tag-remove-chip"
                      onClick={() => removeTaskTag(selectedTask.id, tag)}
                      type="button"
                    >
                      {tag} ×
                    </button>
                  ))
                ) : (
                  <p className="tag-empty">This task has no tags yet.</p>
                )}
              </div>
            </>
          ) : (
            <p className="tag-empty">Select a task to edit tags.</p>
          )}
        </section>
      </div>
    </section>
  );
}