import { useId, useRef, useState } from "react";
import { Check, Plus, Pencil, Trash2, X, ArrowUpRight } from "lucide-react";
import type { Task, Priority } from "../types";
interface Props {
  tasks: Task[];
  onChange: (tasks: Task[], activity: string) => void;
  expanded?: boolean;
}
export function Tasks({ tasks, onChange, expanded = false }: Props) {
  const priorityId = useId();
  const opener = useRef<HTMLElement | null>(null);
  function close() {
    setAdding(false);
    requestAnimationFrame(() => opener.current?.focus());
  }
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [showAll, setShowAll] = useState(expanded);
  const visible = tasks.filter(
    (t) =>
      filter === "all" || (filter === "completed" ? t.completed : !t.completed),
  );
  function open(task?: Task) {
    opener.current = document.activeElement as HTMLElement;
    setEditing(task ?? null);
    setTitle(task?.title ?? "");
    setPriority(task?.priority ?? "medium");
    setDueDate(task?.dueDate ?? "");
    setAdding(true);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (editing && !window.confirm(`Save changes to “${editing.title}”?`))
      return;
    onChange(
      editing
        ? tasks.map((t) =>
            t.id === editing.id
              ? {
                  ...t,
                  title: title.trim(),
                  priority,
                  dueDate: dueDate || undefined,
                }
              : t,
          )
        : [
            ...tasks,
            {
              id: crypto.randomUUID(),
              title: title.trim(),
              priority,
              completed: false,
              ...(dueDate ? { dueDate } : {}),
            },
          ],
      editing ? "Task updated" : "New task created",
    );
    close();
  }
  return (
    <section className="panel tasks-panel" aria-label="Task management">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">STAY ON COURSE</span>
          <h2>
            My tasks{" "}
            <span className="count">
              {tasks.filter((t) => !t.completed).length}
            </span>
          </h2>
        </div>
        <button
          className="icon-button"
          onClick={() => open()}
          aria-label="Add task"
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="tabs">
        {(["all", "pending", "completed"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f[0].toUpperCase() + f.slice(1)}
            {f === "all" && <span>{tasks.length}</span>}
          </button>
        ))}
      </div>
      <div className="task-list">
        {(showAll ? visible : visible.slice(0, 4)).map((t) => (
          <div
            className={`task-row ${t.completed ? "completed" : ""}`}
            key={t.id}
          >
            <button
              className="checkbox"
              aria-label={`${t.completed ? "Reopen" : "Complete"} ${t.title}`}
              onClick={() =>
                onChange(
                  tasks.map((x) =>
                    x.id === t.id ? { ...x, completed: !x.completed } : x,
                  ),
                  t.completed ? "Task reopened" : "Task completed",
                )
              }
            >
              {t.completed && <Check size={12} />}
            </button>
            <div className="task-copy">
              <span>{t.title}</span>
              <small className={`priority ${t.priority}`}>
                <i />
                {t.priority} priority {t.dueDate && ` · Due ${t.dueDate}`}
              </small>
            </div>
            <div className="task-actions">
              <button aria-label={`Edit ${t.title}`} onClick={() => open(t)}>
                <Pencil size={13} />
              </button>
              <button
                aria-label={`Delete ${t.title}`}
                onClick={() =>
                  window.confirm(
                    `Delete “${t.title}”? This cannot be undone.`,
                  ) &&
                  onChange(
                    tasks.filter((x) => x.id !== t.id),
                    "Task deleted",
                  )
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {!visible.length && (
          <p className="empty">
            {filter === "completed"
              ? "Completed tasks will appear here."
              : "A clear horizon. Add your next objective."}
          </p>
        )}
      </div>
      <button
        className="text-button task-footer"
        onClick={() => (visible.length > 4 ? setShowAll(!showAll) : open())}
      >
        {visible.length > 4
          ? showAll
            ? "Show fewer tasks"
            : "View all tasks"
          : "Add a new objective"}
        <ArrowUpRight size={14} />
      </button>
      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-dialog-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "Tab") {
                const nodes = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,select",
                );
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="panel-heading">
              <h2 id="task-dialog-title">
                {editing ? "Edit objective" : "New objective"}
              </h2>
              <button
                className="icon-button"
                aria-label="Close task editor"
                onClick={() => setAdding(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save}>
              <label>
                Task name
                <input
                  autoFocus
                  required
                  maxLength={180}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What would you like to accomplish?"
                />
              </label>
              <label>
                Due date (optional)
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <label htmlFor={priorityId}>
                Priority
                <select
                  id={priorityId}
                  aria-label="Priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
              </label>
              <button className="primary-button" disabled={!title.trim()}>
                Save task <Check size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
