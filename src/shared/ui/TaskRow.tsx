import type { TodoTask } from "../types/todo";

interface TaskRowProps {
  task: TodoTask;
  onToggle: (id: string) => void;
}

function AssigneeAvatars({ assignees }: { assignees: string[] }) {
  return (
    <div className="task-assignees" aria-label="Task assignees">
      {assignees.map((name) => (
        <span key={name} className="task-assignee-avatar">
          {name}
        </span>
      ))}
    </div>
  );
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

        {task.priority === "urgent" ? (
          <p className="task-meta task-meta-urgent">
            <span className="task-meta-dot" />
            Urgent
          </p>
        ) : task.subtitle ? (
          <p className="task-meta">{task.subtitle}</p>
        ) : task.kind === "delay" ? (
          <p className="task-meta task-meta-delay">Delay Task</p>
        ) : null}
      </div>

      <div className="task-right">
        {task.assignees?.length ? <AssigneeAvatars assignees={task.assignees} /> : null}
        {task.dueText ? <span className="task-due-text">{task.dueText}</span> : null}
        {isCompleted ? <span className="task-completed-icon">✓</span> : null}
      </div>
    </article>
  );
}
