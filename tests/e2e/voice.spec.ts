import { test, expect } from "@playwright/test";
async function mockBrowserVoice(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const state = {
      recognizers: [] as Recognition[],
      utterances: [] as Utterance[],
      cancelled: 0,
      denied: false,
    };
    class Recognition {
      continuous = true;
      interimResults = false;
      lang = "";
      maxAlternatives = 0;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      constructor() {
        state.recognizers.push(this);
      }
      start() {
        queueMicrotask(() =>
          state.denied
            ? this.onerror?.({ error: "not-allowed" })
            : this.onstart?.(),
        );
      }
      stop() {
        queueMicrotask(() => this.onend?.());
      }
      abort() {}
    }
    class Utterance {
      text: string;
      voice: { name: string } | null = null;
      lang = "";
      rate = 1;
      pitch = 1;
      volume = 1;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const voices = [
      {
        name: "Mock Daniel",
        lang: "en-GB",
        voiceURI: "mock-daniel",
        localService: true,
        default: true,
      },
      {
        name: "Mock English US",
        lang: "en-US",
        voiceURI: "mock-us",
        localService: true,
        default: false,
      },
    ];
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: Recognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: Utterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => voices,
        addEventListener() {},
        removeEventListener() {},
        cancel() {
          state.cancelled++;
        },
        speak(item: Utterance) {
          state.utterances.push(item);
          queueMicrotask(() => item.onstart?.());
        },
      },
    });
    Object.defineProperty(window, "__voiceMock", { value: state });
  });
}
const answer = {
  content:
    "## Answer\n\n**Growth** compounds.\n\n| Year | Value |\n| --- | --- |\n| 1 | £105 |",
  proposals: [],
  events: [],
  model: "mock",
};
test("one voice question is transcribed, sent once, rendered as Markdown and read with browser start/end events", async ({
  page,
}) => {
  await mockBrowserVoice(page);
  let requests = 0;
  await page.route("**/api/chat", (route) => {
    requests++;
    return route.fulfill({ json: answer });
  });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").recognizers.length,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").utterances.length,
    ),
  ).toBe(0);
  await page.getByRole("button", { name: "Ask by voice" }).click();
  await expect(
    page.getByRole("status", { name: "Voice status" }),
  ).toContainText("Listening");
  await expect(page.locator(".neural-state-readout")).toContainText(
    "Listening",
  );
  await page.evaluate(() =>
    Reflect.get(window, "__voiceMock").recognizers[0].onresult({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "Explain compound interest" } },
      ],
    }),
  );
  await page.getByRole("button", { name: "Stop Listening" }).click();
  await expect(
    page.getByRole("heading", { name: "Answer", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toContainText("£105");
  await expect(
    page.getByRole("status", { name: "Voice status" }),
  ).toContainText("Speaking");
  await expect(page.locator(".neural-state-readout")).toContainText(
    "Responding",
  );
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").utterances[0].voice.name,
    ),
  ).toBe("Mock Daniel");
  await page.evaluate(() =>
    Reflect.get(window, "__voiceMock").utterances[0].onend(),
  );
  await expect(
    page.getByRole("status", { name: "Voice status" }),
  ).toContainText("Ready");
  await expect(page.locator(".neural-state-readout")).toContainText("Idle");
  expect(requests).toBe(1);
});
test("permission denial gives a visible error and text input remains available", async ({
  page,
}) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.evaluate(() => {
    const state = Reflect.get(window, "__voiceMock"); state.denied = true; state.observedStates = [];
    const readout = document.querySelector('.neural-state-readout')!;
    new MutationObserver(() => state.observedStates.push(readout.textContent)).observe(readout, {subtree:true, childList:true, characterData:true});
  });
  await page.getByRole("button", { name: "Ask by voice" }).click();
  await expect(page.getByRole("alert")).toContainText("permission was denied");
  await expect(
    page.getByRole("textbox", { name: "Message AXIOM" }),
  ).toBeEnabled();
  // The warning intentionally expires after 2.2s. Observe its transition rather
  // than requiring it to remain on screen while software WebGL catches up.
  expect(await page.evaluate(() => Reflect.get(window, "__voiceMock").observedStates.some((text:string) => text.includes('Attention')))).toBe(true);
  await expect(page.locator('.neural-state-readout')).toContainText('Idle');
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").utterances.length,
    ),
  ).toBe(0);
});
test("voice preview uses the selected reported voice and Stop Speaking cancels playback", async ({
  page,
}) => {
  await mockBrowserVoice(page);
  await page.goto("/");
  await page.getByText("Voice and speaking settings", { exact: true }).click();
  await page
    .getByLabel("Speaking voice", { exact: true })
    .selectOption("mock-us");
  await page.getByRole("button", { name: "Preview voice" }).click();
  await expect(
    page.getByRole("status", { name: "Voice status" }),
  ).toContainText("Speaking");
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").utterances[0].voice.name,
    ),
  ).toBe("Mock English US");
  await page.getByRole("button", { name: "Stop Speaking" }).click();
  await expect(
    page.getByRole("status", { name: "Voice status" }),
  ).toContainText("Ready");
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").recognizers.length,
    ),
  ).toBe(0);
});
test("mute prevents a late Groq answer from starting speech", async ({
  page,
}) => {
  await mockBrowserVoice(page);
  let resolve!: (value: import("@playwright/test").Route) => void;
  const received = new Promise<import("@playwright/test").Route>((done) => {
    resolve = done;
  });
  await page.route("**/api/chat", (route) => {
    resolve(route);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ask by voice" }).click();
  await page.evaluate(() =>
    Reflect.get(window, "__voiceMock").recognizers[0].onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "Explain interest" } }],
    }),
  );
  await page.getByRole("button", { name: "Stop Listening" }).click();
  const route = await received;
  await page.getByRole("button", { name: "Mute speech", exact: true }).click();
  await route.fulfill({ json: answer });
  await expect(
    page.getByRole("heading", { name: "Answer", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => Reflect.get(window, "__voiceMock").utterances.length,
    ),
  ).toBe(0);
});
