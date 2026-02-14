import { widgetColorClass } from "../../shared/theme/tokens";
import type { TodoTask } from "../../shared/types/todo";

interface WidgetTaskRowProps {
  task: TodoTask;
}

export function WidgetTaskRow({ task }: WidgetTaskRowProps) {
  return (
    <article className="widget-task-row">
      <p className="widget-task-title" title={task.title}>
        {task.hasException ? <span className="widget-task-exception">!</span> : null}
        {task.title}
      </p>
      <span className={`widget-dot ${widgetColorClass[task.widgetColor]}`} aria-hidden="true" />
    </article>
  );
}
