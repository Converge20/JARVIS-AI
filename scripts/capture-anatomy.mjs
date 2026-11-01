/** Reproducible review captures from real controls. Start Vite on port 5173 first. */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const software = process.env.AXIOM_SOFTWARE_WEBGL === "1";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: software
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    : [],
});
try {
  await mkdir("docs", { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    timezoneId: "America/New_York",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173");
  await page.waitForSelector("canvas[data-anatomy-ready=true]", {
    timeout: 60000,
  });
  const scenario = page.getByRole("button", {
    name: "Create a task",
    exact: true,
  });
  await scenario.click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "docs/axiom-desktop.jpg",
    fullPage: true,
    type: "jpeg",
    quality: 88,
    timeout: 60000,
  });
  await page.locator(".neural-stage").screenshot({
    path: "docs/axiom-brain.jpg",
    type: "jpeg",
    quality: 90,
    timeout: 60000,
  });
  await page
    .getByRole("button", { name: "Anatomy · effects off", exact: true })
    .click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "docs/axiom-anatomy.jpg",
    fullPage: true,
    type: "jpeg",
    quality: 88,
    timeout: 60000,
  });
  await page.getByRole("button", { name: "Rotate brain left" }).click();
  await page.getByRole("button", { name: "Rotate brain left" }).click();
  await page.waitForTimeout(200);
  await page.locator(".neural-stage").screenshot({
    path: "docs/axiom-anatomy-side.jpg",
    type: "jpeg",
    quality: 90,
    timeout: 60000,
  });
  await page.getByRole("button", { name: "Reset brain view" }).click();
  await page
    .getByRole("button", { name: "Anatomy · effects off", exact: true })
    .click();
  await page.getByLabel("Visual quality").selectOption("static");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: "docs/axiom-fallback.jpg",
    fullPage: true,
    type: "jpeg",
    quality: 85,
    timeout: 60000,
  });
  await page.getByLabel("Visual quality").selectOption("eco");
  await page.waitForSelector("canvas[data-anatomy-ready=true]", {
    timeout: 60000,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "docs/axiom-mobile.jpg",
    fullPage: true,
    type: "jpeg",
    quality: 85,
    timeout: 60000,
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Captured desktop, detail, effects-off, side, fallback and mobile. No page errors.",
  );
  // Reference surfaces are rendered separately, without AXIOM geometry modifications.
  if (
    existsSync("work/anatomy/mri-brain.glb") &&
    existsSync("work/anatomy/bodyparts-brain.glb")
  )
    for (const [url, file] of [
      ["mri", "anatomy-reference-cortex.jpg"],
      ["bodyparts", "anatomy-reference-atlas.jpg"],
    ]) {
      const reference = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      });
      await reference.goto(
        `http://127.0.0.1:5173/scripts/reference-view.html?model=${url}`,
      );
      await reference.waitForFunction(() => !!window.viewer);
      await reference.evaluate(() => {
        viewer.renderer.setAnimationLoop(null);
        viewer.renderer.render(viewer.scene, viewer.camera);
      });
      await reference.screenshot({
        path: `docs/${file}`,
        type: "jpeg",
        quality: 86,
        timeout: 60000,
      });
      await reference.close();
    }
} finally {
  await browser.close();
}
