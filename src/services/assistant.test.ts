import { afterEach, expect, it, vi } from "vitest";
import { assistant } from "./assistant";
import { initialTasks } from "./tasks";
afterEach(() => vi.useRealTimers());
it("uses real pending tasks for the scripted briefing", async () => {
  vi.useFakeTimers();
  const reply = assistant.reply("Plan my day", { tasks: initialTasks });
  await vi.runAllTimersAsync();
  expect(await reply).toContain("3 pending tasks");
  expect(await reply).toContain("Explore your command center");
});
it("honestly describes disconnected capabilities", async () => {
  vi.useFakeTimers();
  const reply = assistant.reply("What can you do?", { tasks: [] });
  await vi.runAllTimersAsync();
  expect(await reply).toContain("scripted");
  expect(await reply).toContain("not connected");
});
