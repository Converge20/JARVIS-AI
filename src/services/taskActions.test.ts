import { expect, it } from "vitest";
import { applyTaskProposal } from "./taskActions";
import type { Task, TaskProposal } from "../types";
const task: Task = {
  id: "finance",
  title: "Review finance",
  completed: false,
  priority: "medium",
};
it("creates a dated task and preserves existing data", () => {
  const next = { ...task, id: "new", dueDate: "2026-11-02" };
  expect(
    applyTaskProposal([task], { id: "p", kind: "create_task", task: next }),
  ).toEqual([task, next]);
});
it("updates or deletes only the exact confirmed task snapshot", () => {
  const proposal: TaskProposal = {
    id: "p",
    kind: "update_task",
    before: task,
    task: { ...task, completed: true },
  };
  expect(applyTaskProposal([task], proposal)[0].completed).toBe(true);
  expect(task.completed).toBe(false);
  expect(() =>
    applyTaskProposal([{ ...task, title: "Changed" }], proposal),
  ).toThrow("changed");
  expect(
    applyTaskProposal([task], { id: "d", kind: "delete_task", before: task }),
  ).toEqual([]);
});
it("rejects invalid model dates and unknown operations", () => {
  expect(() =>
    applyTaskProposal([], {
      id: "p",
      kind: "create_task",
      task: { ...task, dueDate: "2026-02-30" },
    }),
  ).toThrow("Invalid");
  expect(() =>
    applyTaskProposal([task], {
      id: "p",
      kind: "execute_code" as "update_task",
      before: task,
      task,
    }),
  ).toThrow("Invalid");
});
