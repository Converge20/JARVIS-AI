import { expect, test } from "@playwright/test";
import type { Locator } from "@playwright/test";
async function pixelCounts(viewport: Locator) {
  const data = (await viewport.screenshot()).toString("base64");
  return viewport.page().evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let blue = 0,
      orange = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (b > 90 && b > r * 1.5 && g > 50) blue++;
      if (r > 130 && r > g * 1.2 && g > b * 1.2) orange++;
    }
    return { blue, orange };
  }, data);
}
test("renders the actual 3D brain, orange signals, all six states and five scenarios", async ({
  page,
}) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByText("PROCEDURAL 3D ANATOMY", { exact: true }),
  ).toBeVisible();
  const states = page.getByRole("group", {
    name: "Neural demonstration states",
  });
  const idle = await pixelCounts(page.locator(".brain-viewport"));
  expect(idle.blue).toBeGreaterThan(1500);
  for (const name of [
    "Listening",
    "Analyzing",
    "Task processing",
    "Knowledge retrieval",
    "Responding",
    "Idle",
  ]) {
    await states.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".neural-state-readout")).toContainText(name);
  }
  await states.getByRole("button", { name: "Analyzing", exact: true }).click();
  await expect
    .poll(
      async () => (await pixelCounts(page.locator(".brain-viewport"))).orange,
      { timeout: 8000 },
    )
    .toBeGreaterThan(idle.orange + 20);
  for (const command of [
    "Plan my schedule",
    "Explain a finance concept",
    "Analyze information",
    "Create a task",
    "Answer a general question",
  ]) {
    await page.getByRole("button", { name: command, exact: true }).click();
    await expect(page.locator(".neural-description")).toContainText("pattern");
  }
  await page.getByRole("button", { name: "Rotate brain right" }).click();
  await page.getByRole("button", { name: "Reset brain view" }).click();
  await page.getByLabel("Visual quality").selectOption("eco");
  await expect(page.locator("canvas")).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("uses the same anatomy without WebGL and keeps tasks and conversation usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebGL2RenderingContext", {
      value: undefined,
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("WebGL is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".brain-fallback")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Activate voice" }).click();
  await expect(page.getByText("Listening simulation active…")).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task name").fill("Fallback task");
  await page.getByRole("button", { name: "Save task" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("jarvis.tasks.v1")),
  ).toContain("Fallback task");
  await page
    .getByRole("textbox", { name: "Message AXIOM" })
    .fill("What can you do?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/My replies are scripted/)).toBeVisible();
});
test("recovers gracefully from WebGL context loss", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) =>
      canvas
        .getContext("webgl2")
        ?.getExtension("WEBGL_lose_context")
        ?.loseContext(),
    );
  await expect(
    page.getByText("3D rendering was interrupted.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".brain-fallback")).toBeVisible();
  await page.getByRole("button", { name: "Retry 3D" }).click();
  await expect(page.locator("canvas")).toBeVisible();
});
test("pauses WebGL draw calls for reduced motion and supports a deliberate static view", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElements;
    let calls = 0;
    Object.defineProperty(window, "__neuralDrawCalls", { get: () => calls });
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      calls++;
      return original.apply(this, args);
    };
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".neural-state-readout")).toContainText(
    "MOTION PAUSED",
  );
  await page.waitForTimeout(700);
  const count = await page.evaluate(() =>
    Reflect.get(window, "__neuralDrawCalls"),
  );
  expect(count).toBeGreaterThan(0);
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(() => Reflect.get(window, "__neuralDrawCalls")),
  ).toBe(count);
  await page.getByLabel("Visual quality").selectOption("static");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".brain-fallback")).toBeVisible();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("switching Static, Eco, and Full detail does not report intentional disposal as context failure", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  for (const quality of ["static", "eco", "static", "full"]) {
    await page.getByLabel("Visual quality").selectOption(quality);
    if (quality === "static")
      await expect(page.locator("canvas")).toHaveCount(0);
    else {
      await expect(page.locator("canvas")).toBeVisible();
      await expect(
        page.getByText("PROCEDURAL 3D ANATOMY", { exact: true }),
      ).toBeVisible();
    }
    await page.waitForTimeout(250);
    await expect(
      page.getByText("3D rendering was interrupted.", { exact: false }),
    ).toHaveCount(0);
  }
});
