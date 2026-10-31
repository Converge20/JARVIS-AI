import { useEffect, useState } from "react";
import { loadTasks, TASK_KEY } from "../services/tasks";
import type { Task } from "../types";
export function useTasks() {
  const [loaded] = useState(loadTasks);
  const [tasks, setTasks] = useState<Task[]>(loaded.tasks);
  const [error, setError] = useState(loaded.error);
  const [canSave, setCanSave] = useState(!loaded.error);
  useEffect(() => {
    if (!canSave) return;
    try {
      localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
      setError("");
    } catch {
      setError(
        "Browser storage is unavailable or full. Your changes are only saved for this session.",
      );
    }
  }, [tasks, canSave]);
  return { tasks, setTasks, error, replaceStorage: () => setCanSave(true) };
}
