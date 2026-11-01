import { expect, test } from "@playwright/test";
test("task lifecycle persists after a real browser refresh", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name").fill("Review prototype");
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.reload();
  await page.getByRole("button", { name: "View all tasks" }).click();
  await expect(
    page.getByText("Review prototype", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Review prototype" }).click();
  await page.getByLabel("Task name").fill("Share prototype");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Complete Share prototype" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reopen Share prototype" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Share prototype" }).click();
  await page.reload();
  await expect(page.getByText("Share prototype", { exact: true })).toHaveCount(
    0,
  );
});
test("chat, voice, navigation and responsive layouts work without external requests", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => {
          throw new Error("Microphone must never be accessed in demo");
        },
      },
    });
  });
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        content: "Mock provider: You have 3 pending tasks.",
        proposals: [],
        events: ["retrieval"],
        model: "mock",
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Voice not enabled" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Message AXIOM" })
    .fill("Plan my day");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText(/Mock provider: You have 3 pending tasks/),
  ).toBeVisible();
  for (const name of [
    "Conversation",
    "Tasks",
    "Activity",
    "Integrations",
    "Overview",
  ])
    await page
      .getByRole("navigation")
      .getByRole("button", { name: new RegExp(name) })
      .click();
  await expect(
    page.getByText(/Mock provider: You have 3 pending tasks/),
  ).toBeVisible();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("damaged storage is preserved until explicitly replaced", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("jarvis.tasks.v1", "damaged"));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be read");
  expect(
    await page.evaluate(() => localStorage.getItem("jarvis.tasks.v1")),
  ).toBe("damaged");
  await page
    .getByRole("button", { name: "Retry / replace saved data" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("jarvis.tasks.v1")),
  ).toBe("[]");
});
