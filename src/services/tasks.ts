import { BRAND } from "../config/brand";
import type { Task } from "../types";
export const TASK_KEY = "jarvis.tasks.v1";
export const initialTasks: Task[] = [
  {
    id: "welcome-1",
    title: "Explore your command center",
    priority: "high",
    completed: false,
  },
  {
    id: "welcome-2",
    title: "Plan your next big idea",
    priority: "medium",
    completed: false,
  },
  {
    id: "welcome-3",
    title: `Try a conversation with ${BRAND.name}`,
    priority: "low",
    completed: false,
  },
  {
    id: "welcome-4",
    title: "Initialize personal workspace",
    priority: "medium",
    completed: true,
  },
];
export function loadTasks(): { tasks: Task[]; error: string } {
  try {
    const raw = localStorage.getItem(TASK_KEY);
    if (raw === null) return { tasks: initialTasks, error: "" };
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (t) =>
          t &&
          typeof t.id === "string" &&
          typeof t.title === "string" &&
          t.title.trim() &&
          t.title.length <= 180 &&
          ["high", "medium", "low"].includes(t.priority) &&
          typeof t.completed === "boolean" &&
          (t.dueDate === undefined ||
            (typeof t.dueDate === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) &&
              !Number.isNaN(Date.parse(t.dueDate)) &&
              new Date(t.dueDate).toISOString().slice(0, 10) === t.dueDate)),
      ) ||
      new Set(parsed.map((t) => t.id)).size !== parsed.length
    )
      throw new Error("Invalid tasks");
    return { tasks: parsed, error: "" };
  } catch {
    return {
      tasks: [],
      error:
        "Saved tasks could not be read. Changes will stay in this session until you choose to replace the saved data.",
    };
  }
}
