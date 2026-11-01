import "@testing-library/jest-dom/vitest";
import { beforeEach, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { TASK_KEY } from "./services/tasks";
beforeEach(() => localStorage.clear());
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
it("shows labeled scripted chat and navigates without losing the conversation", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.type(
    screen.getByRole("textbox", { name: "Message AXIOM" }),
    "What can you do?",
  );
  await user.click(screen.getByRole("button", { name: "Send message" }));
  expect(screen.getByRole("status")).toHaveTextContent("simulated reply");
  expect(
    await screen.findByText(/My replies are scripted/, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  await user.click(
    within(screen.getByRole("navigation")).getByRole("button", {
      name: "Conversation",
    }),
  );
  expect(screen.getByText(/My replies are scripted/)).toBeInTheDocument();
});
it("toggles voice simulation and session preferences", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Activate voice" }));
  expect(screen.getByText("Listening simulation active…")).toBeInTheDocument();
  expect(screen.getByText("Microphone is not accessed")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Stop demonstration" }));
  await user.click(screen.getByRole("button", { name: "Preferences" }));
  await user.click(
    screen.getByRole("button", { name: "Ambient animations On" }),
  );
  expect(
    screen.getByRole("button", { name: "Ambient animations Paused" }),
  ).toHaveAttribute("aria-pressed", "false");
});
