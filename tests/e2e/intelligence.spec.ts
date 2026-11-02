import { test, expect } from "@playwright/test";
test("confirms, persists and cancels AI task operations, retaining multi-turn context", async ({
  page,
}) => {
  const finance = {
    id: "finance",
    title: "Review finance",
    priority: "medium",
    completed: false,
  };
  const study = {
    id: "study",
    title: "Study finance",
    priority: "high",
    completed: false,
    dueDate: "2026-11-02",
  };
  await page.addInitScript((task) => {
    if (localStorage.getItem("jarvis.tasks.v1") === null)
      localStorage.setItem("jarvis.tasks.v1", JSON.stringify([task]));
  }, finance);
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { status: "ready", message: "Mock server configured" },
    }),
  );
  const inputs: {
    messages: { role: string; content: string }[];
    tasks: unknown[];
  }[] = [];
  const replies = [
    {
      content: "Please confirm this new task.",
      proposals: [{ id: "1", kind: "create_task", task: study }],
      events: ["task"],
    },
    {
      content: "Your outstanding tasks are Review finance and Study finance.",
      proposals: [],
      events: ["retrieval"],
    },
    {
      content: "Confirm completing Review finance.",
      proposals: [
        {
          id: "2",
          kind: "update_task",
          before: finance,
          task: { ...finance, completed: true },
        },
      ],
      events: ["task"],
    },
    {
      content: "Confirm deleting Study finance.",
      proposals: [{ id: "3", kind: "delete_task", before: study }],
      events: ["task"],
    },
  ];
  await page.route("**/api/chat", (route) => {
    inputs.push(route.request().postDataJSON());
    return route.fulfill({ json: { ...replies.shift(), model: "mock" } });
  });
  await page.goto("/");
  const send = async (text: string) => {
    await page.getByRole("textbox", { name: "Message AXIOM" }).fill(text);
    await page.getByRole("button", { name: "Send message" }).click();
  };
  await send("Create a task to study finance tomorrow.");
  await expect(
    page.getByText("Proposed: Study finance", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("jarvis.tasks.v1")),
  ).not.toContain("Study finance");
  await page.getByRole("button", { name: "Confirm task change" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("jarvis.tasks.v1")),
  ).toContain("2026-11-02");
  await send("Show my outstanding assignments.");
  await expect(
    page.getByText(
      "Your outstanding tasks are Review finance and Study finance.",
    ),
  ).toBeVisible();
  expect(
    inputs[1].messages.some((m) =>
      m.content.includes("Application result: create task applied"),
    ),
  ).toBe(true);
  expect(inputs[1].tasks).toHaveLength(2);
  await send("Mark my finance review task as complete.");
  await page.getByRole("button", { name: "Confirm task change" }).click();
  await send("Delete the study task.");
  await page.getByRole("button", { name: "Cancel task change" }).click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jarvis.tasks.v1")!),
  );
  expect(saved.find((t: { id: string }) => t.id === "finance").completed).toBe(
    true,
  );
  expect(saved.some((t: { id: string }) => t.id === "study")).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reopen Review finance" }),
  ).toBeVisible();
  await expect(page.getByText("Study finance", { exact: true })).toBeVisible();
});
test("live backend reports configuration without any AI call", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message AXIOM" })
    .fill("Explain compound interest.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toContainText(
    /Configuration required|disabled/,
  );
  await expect(
    page.getByRole("button", { name: "Ask by voice" }),
  ).toBeVisible();
  await expect(page.locator(".neural-state-readout")).toContainText("Idle");
});
