import { test, expect, type Route } from "@playwright/test";
test("Check connection uses the real proxied JSON POST and reports accepted preview access", async ({
  page,
}) => {
  await page.goto("/");
  const feedback = page.getByRole("status", {
    name: "Connection check result",
  });
  await expect(feedback).toContainText(
    "Application server reachable; preview origin accepted.",
  );
  await expect(feedback).toContainText("Checked at");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/status") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Check connection" }).click();
  const result = await response;
  expect(result.status()).toBe(200);
  expect(result.request().postDataJSON()).toEqual({});
  await expect(feedback).toHaveAttribute("aria-busy", "false");
  await expect(feedback).toContainText(
    /Configuration required|AI requests are disabled/,
  );
  await expect(feedback).toContainText("no Groq inference request");
});
test("Check connection displays loading and a rejected-origin result rather than silently completing", async ({
  page,
}) => {
  await page.goto("/");
  const feedback = page.getByRole("status", {
    name: "Connection check result",
  });
  await expect(feedback).toContainText("Checked at");
  let receive!: (route: Route) => void;
  const received = new Promise<Route>((resolve) => {
    receive = resolve;
  });
  await page.route("**/api/status", (route) => {
    receive(route);
  });
  await page.getByRole("button", { name: "Check connection" }).click();
  const route = await received;
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await expect(feedback).toHaveAttribute("aria-busy", "true");
  await route.fulfill({
    status: 403,
    json: {
      error:
        "Request origin is not allowed. Restart AXIOM inside this Codespace.",
    },
  });
  await expect(feedback).toHaveAttribute("aria-busy", "false");
  await expect(feedback).toContainText("Request origin is not allowed.");
  await expect(
    page.getByRole("button", { name: "Check connection" }),
  ).toBeEnabled();
});
