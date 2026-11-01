import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { TASK_KEY } from "./services/tasks";
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "configuration_required",
        message: "Configuration required: set GROQ_API_KEY on the server.",
      }),
    }),
  );
});
afterEach(() => vi.restoreAllMocks());
it("creates, edits, completes, persists, and deletes a task", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Add task" }));
  await user.type(screen.getByLabelText("Task name"), "Prepare launch");
  await user.selectOptions(screen.getByLabelText("Priority"), "high");
  await user.click(screen.getByRole("button", { name: "Save task" }));
  expect(JSON.parse(localStorage.getItem(TASK_KEY)!)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: "Prepare launch",
        priority: "high",
        completed: false,
      }),
    ]),
  );
  await user.click(screen.getByRole("button", { name: "View all tasks" }));
  await user.click(screen.getByRole("button", { name: "Edit Prepare launch" }));
  await user.clear(screen.getByLabelText("Task name"));
  await user.type(screen.getByLabelText("Task name"), "Launch prototype");
  await user.click(screen.getByRole("button", { name: "Save task" }));
  await user.click(
    screen.getByRole("button", { name: "Complete Launch prototype" }),
  );
  view.unmount();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "View all tasks" }));
  expect(
    screen.getByRole("button", { name: "Reopen Launch prototype" }),
  ).toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Delete Launch prototype" }),
  );
  expect(screen.queryByText("Launch prototype")).not.toBeInTheDocument();
  expect(localStorage.getItem(TASK_KEY)).not.toContain("Launch prototype");
});
it("shows genuine mocked responses, preserves history and blocks repeated submissions", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ready", message: "Configured" }),
    })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Message AXIOM" }),
    "Explain finance",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "processing your request",
  );
  expect(screen.getByRole("button", { name: "Plan my day" })).toBeDisabled();
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Analyzing",
  );
  finish({
    ok: true,
    json: async () => ({
      content: "Mocked real-provider response",
      proposals: [],
      events: [],
      model: "mock",
    }),
  });
  expect(
    await screen.findByText("Mocked real-provider response"),
  ).toBeInTheDocument();
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Idle",
  );
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: "Conversation",
    }),
  );
  expect(screen.getByText("Mocked real-provider response")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("shows configuration errors without a fabricated assistant answer", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "configuration_required",
          message: "Configuration required",
        }),
      })
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Configuration required: no API key" }),
      }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Plan my day" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Configuration required",
  );
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Idle",
  );
  expect(screen.getByRole("log")).not.toHaveTextContent("pending tasks");
});
it("requires confirmation for AI task creation and keeps the saved task across navigation", async () => {
  const task = {
    id: "new",
    title: "Study finance",
    priority: "medium",
    completed: false,
    dueDate: "2026-11-02",
  };
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ready", message: "Configured" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "Please confirm the proposed task.",
          proposals: [{ id: "p", kind: "create_task", task }],
          events: ["task"],
          model: "mock",
        }),
      }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Message AXIOM" }),
    "Create a task to study finance tomorrow",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  await screen.findByRole("button", { name: "Confirm task change" });
  expect(localStorage.getItem(TASK_KEY)).not.toContain("Study finance");
  await user.click(screen.getByRole("button", { name: "Confirm task change" }));
  expect(localStorage.getItem(TASK_KEY)).toContain("Study finance");
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Task processing",
  );
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: /Tasks/,
    }),
  );
  expect(screen.getByText("Study finance")).toBeInTheDocument();
});
it("acknowledges actual task retrieval and does not simulate audio output", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "ready", message: "Configured" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "Your pending tasks.",
          proposals: [],
          events: ["retrieval"],
          model: "mock",
        }),
      }),
  );
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Plan my day" }));
  await screen.findByText("Your pending tasks.");
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Knowledge retrieval",
  );
  expect(
    screen.getByRole("button", { name: "Voice not enabled" }),
  ).toBeDisabled();
});
it("keeps voice inactive and exposes future voice preferences", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(
    screen.getByRole("button", { name: "Voice not enabled" }),
  ).toBeDisabled();
  expect(screen.getByText("Microphone is not accessed")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Preferences" }));
  await user.selectOptions(
    screen.getByLabelText("Future synthetic voice"),
    "fable",
  );
  await user.click(
    screen.getByRole("button", { name: "Ambient animations On" }),
  );
  expect(
    screen.getByRole("button", { name: "Ambient animations Paused" }),
  ).toHaveAttribute("aria-pressed", "false");
});
