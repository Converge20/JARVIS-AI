import { beforeEach, describe, expect, it } from "vitest";
import { initialTasks, loadTasks, TASK_KEY } from "./tasks";
describe("task storage", () => {
  beforeEach(() => localStorage.clear());
  it("initializes a fresh workspace with onboarding tasks", () =>
    expect(loadTasks().tasks).toEqual(initialTasks));
  it("preserves an intentionally empty list", () => {
    localStorage.setItem(TASK_KEY, "[]");
    expect(loadTasks()).toEqual({ tasks: [], error: "" });
  });
  it("loads saved tasks", () => {
    localStorage.setItem(TASK_KEY, JSON.stringify(initialTasks));
    expect(loadTasks().tasks).toEqual(initialTasks);
  });
  it.each([
    "broken",
    "{}",
    '[{"id":"x"}]',
    JSON.stringify([initialTasks[0], initialTasks[0]]),
  ])("handles corrupted data without silently overwriting it: %s", (value) => {
    localStorage.setItem(TASK_KEY, value);
    expect(loadTasks().error).toBeTruthy();
    expect(localStorage.getItem(TASK_KEY)).toBe(value);
  });
});
