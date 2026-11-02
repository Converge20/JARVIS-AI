import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { installVoiceMocks } from "../tests/voice-mocks";
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
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
  expect(
    screen.getByRole("status", { name: "AI request status" }),
  ).toHaveTextContent("processing your request");
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
    "Attention",
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
  expect(screen.getByRole("button", { name: "Ask by voice" })).toBeDisabled();
});
it("offers text fallback without starting a microphone and exposes browser voice settings", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByRole("button", { name: "Ask by voice" })).toBeDisabled();
  expect(
    screen.getByText(/Speech recognition is unavailable here/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Preferences" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Speaking voice")).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Ambient animations On" }),
  );
  expect(
    screen.getByRole("button", { name: "Ambient animations Paused" }),
  ).toHaveAttribute("aria-pressed", "false");
});

it("Check connection shows loading, prevents duplicate checks and displays a fresh visible result", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ready",
        message: "Application server reachable; preview origin accepted.",
        model: "mock",
      }),
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
  await screen.findByText(/Checked at/);
  await user.click(screen.getByRole("button", { name: "Check connection" }));
  const feedback = screen.getByRole("status", {
    name: "Connection check result",
  });
  expect(feedback).toHaveAttribute("aria-busy", "true");
  expect(feedback).toHaveTextContent("Checking connection…");
  expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  finish({
    ok: true,
    json: async () => ({
      status: "configuration_required",
      message:
        "Application server reachable. Configuration required: set GROQ_API_KEY.",
    }),
  });
  expect(
    await screen.findByText(
      /Application server reachable. Configuration required/,
    ),
  ).toBeInTheDocument();
  expect(feedback).toHaveAttribute("aria-busy", "false");
  expect(feedback).toHaveTextContent("Checked at");
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("Check connection visibly reports rejected origins and backend outages", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ready", message: "Configured" }),
    })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error:
          "Request origin is not allowed. Restart AXIOM inside this Codespace.",
      }),
    })
    .mockRejectedValueOnce(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByText(/Checked at/);
  await user.click(screen.getByRole("button", { name: "Check connection" }));
  expect(
    await screen.findByText(/Request origin is not allowed/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Check connection" }));
  expect(
    await screen.findByText(/Assistant server unavailable or timed out/),
  ).toBeInTheDocument();
});
it("completes a single voice question through Groq and real speech events without duplicate requests", async () => {
  const mock = installVoiceMocks();
  let finish!: (value: unknown) => void;
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ready",
        message: "Configured",
        model: "mock",
      }),
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
  expect(mock.recognizers).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Ask by voice" }));
  const recognition = mock.recognizers[0];
  act(() => recognition.onstart?.());
  expect(
    screen.getByRole("status", { name: "Voice status" }),
  ).toHaveTextContent("Listening");
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Listening",
  );
  act(() => recognition.result("Explain compound interest", false));
  expect(
    screen.getByRole("status", { name: "Live speech transcript" }),
  ).toHaveTextContent("Explain compound interest");
  act(() => {
    recognition.result("Explain compound interest");
    recognition.onend?.();
  });
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Analyzing",
  );
  expect(mock.synth.speak).not.toHaveBeenCalled();
  finish({
    ok: true,
    json: async () => ({
      content: "## A useful answer\n\n**Interest** can compound.",
      proposals: [],
      events: [],
      model: "mock",
    }),
  });
  expect(
    await screen.findByRole("heading", { name: "A useful answer" }),
  ).toBeInTheDocument();
  expect(mock.utterances).toHaveLength(1);
  const utterance = mock.utterances[0];
  expect(utterance.text).not.toContain("**");
  act(() => utterance.onstart?.(new Event("start") as SpeechSynthesisEvent));
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Responding",
  );
  act(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent));
  expect(document.querySelector(".neural-state-readout")).toHaveTextContent(
    "Idle",
  );
  expect(
    fetch.mock.calls.filter((call) => call[0] === "/api/chat"),
  ).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Ask by voice" }));
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: /Tasks/,
    }),
  );
  expect(mock.recognizers[1].abort).toHaveBeenCalled();
});
