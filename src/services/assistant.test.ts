import { afterEach, expect, it, vi } from "vitest";
import { assistant } from "./assistant";
afterEach(() => vi.unstubAllGlobals());
it("sends bounded multi-turn history and tasks only to the same-origin backend", async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      content: "Mock answer",
      proposals: [],
      events: [],
      model: "mock",
    }),
  });
  vi.stubGlobal("fetch", fetch);
  const reply = await assistant.reply(
    [
      {
        id: "1",
        role: "assistant",
        content: "Workspace",
        time: "",
        local: true,
      },
      { id: "2", role: "user", content: "Explain finance", time: "" },
    ],
    [],
  );
  expect(reply.content).toBe("Mock answer");
  expect(fetch.mock.calls[0][0]).toBe("/api/chat");
  const body = JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.messages).toEqual([{ role: "user", content: "Explain finance" }]);
  expect(body).not.toHaveProperty("apiKey");
});
it("surfaces configuration failures without generating a fake answer", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Configuration required" }),
    }),
  );
  await expect(
    assistant.reply(
      [{ id: "1", role: "user", content: "Hello", time: "" }],
      [],
    ),
  ).rejects.toThrow("Configuration required");
});
it("explains backend outage and does not retry", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
  vi.stubGlobal("fetch", fetch);
  await expect(assistant.status()).rejects.toThrow("server unavailable");
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("explains non-JSON proxy failures as an unavailable backend", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    }),
  );
  await expect(assistant.status()).rejects.toThrow("server unavailable");
});
it("probes with an uncached same-origin JSON POST so origin failures cannot be hidden by a GET health check", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ready",
        message: "Application server reachable",
      }),
    });
  vi.stubGlobal("fetch", fetch);
  await assistant.status();
  expect(fetch).toHaveBeenCalledWith(
    "/api/status",
    expect.objectContaining({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
});
