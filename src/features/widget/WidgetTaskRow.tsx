import type { TodoTask, WidgetAlignMode } from "../../shared/types/todo";

interface WidgetTaskRowProps {
  task: TodoTask;
  onToggle: (id: string) => void;
  alignMode: WidgetAlignMode;
}

export function WidgetTaskRow({ task, onToggle, alignMode }: WidgetTaskRowProps) {
  const isCompleted = task.status === "completed";
  const isLeftAlign = alignMode === "left";
  const dotStatusClass = isCompleted ? "is-completed" : "is-active";

  return (
    <button
      className={`widget-task-row${isCompleted ? " is-completed" : ""}${isLeftAlign ? " is-left" : " is-right"}`}
      onClick={() => onToggle(task.id)}
      type="button"
    >
      {isLeftAlign ? <span className={`widget-dot ${dotStatusClass}`} aria-hidden="true" /> : null}
      <p className="widget-task-title" title={task.title}>
        {task.title}
      </p>
      {isLeftAlign ? null : <span className={`widget-dot ${dotStatusClass}`} aria-hidden="true" />}
    </button>
  );
}
