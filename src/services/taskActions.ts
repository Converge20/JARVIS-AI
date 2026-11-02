import type { Task, TaskProposal } from "../types";
const valid = (task: Task | undefined): task is Task =>
  !!task &&
  typeof task.id === "string" &&
  !!task.id &&
  typeof task.title === "string" &&
  !!task.title.trim() &&
  task.title.length <= 180 &&
  ["high", "medium", "low"].includes(task.priority) &&
  typeof task.completed === "boolean" &&
  (task.dueDate === undefined ||
    (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) &&
      !Number.isNaN(Date.parse(task.dueDate)) &&
      new Date(task.dueDate).toISOString().slice(0, 10) === task.dueDate));
const equal = (a: Task, b: Task) =>
  a.id === b.id &&
  a.title === b.title &&
  a.priority === b.priority &&
  a.completed === b.completed &&
  a.dueDate === b.dueDate;
// Model output never runs code or writes storage. Explicit confirmed application functions do.
export function applyTaskProposal(
  tasks: Task[],
  proposal: TaskProposal,
): Task[] {
  if (proposal.kind === "create_task") {
    if (
      !valid(proposal.task) ||
      tasks.some((t) => t.id === proposal.task!.id) ||
      tasks.length >= 200
    )
      throw new Error("Invalid or duplicate new task, or task limit reached.");
    return [...tasks, proposal.task];
  }
  const current = tasks.find((t) => t.id === proposal.before?.id);
  if (!valid(proposal.before) || !current || !equal(current, proposal.before))
    throw new Error(
      "This task has changed since the proposal. Ask AXIOM again before applying it.",
    );
  if (proposal.kind === "delete_task")
    return tasks.filter((t) => t.id !== current.id);
  if (
    proposal.kind !== "update_task" ||
    !valid(proposal.task) ||
    proposal.task.id !== current.id
  )
    throw new Error("Invalid task change. Nothing was saved.");
  return tasks.map((t) => (t.id === current.id ? proposal.task! : t));
}
