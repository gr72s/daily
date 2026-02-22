import type { TodoTask } from "../types/todo";

interface TaskRowProps {
  task: TodoTask;
  onToggle: (id: string) => void;
}

function formatTaskMeta(task: TodoTask) {
  const tagsText = task.tags && task.tags.length > 0 ? ` · ${task.tags.join(", ")}` : "";
  return `${task.executionDate}${tagsText}`;
}

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const isCompleted = task.status === "completed";

  return (
    <article className={`task-row${isCompleted ? " is-completed" : ""}`}>
      <label className="task-checkbox-wrap" aria-label={`Toggle ${task.title}`}>
        <input
          checked={isCompleted}
          className="task-checkbox"
          onChange={() => onToggle(task.id)}
          type="checkbox"
        />
      </label>

      <div className="task-content">
        <p className="task-title" title={task.title}>
          {task.title}
        </p>
        <p className="task-meta">{formatTaskMeta(task)}</p>
      </div>

      <div className="task-right">
        {isCompleted ? <span className="task-completed-icon">OK</span> : null}
      </div>
    </article>
  );
}
