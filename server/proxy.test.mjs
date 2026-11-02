import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as createViteServer } from "vite";
import { createServer } from "./app.mjs";
import { previewServerConfig } from "./vite-config.mjs";

test(
  "real Vite 5173 → backend 3001 proxy accepts the exact Codespaces HTTPS origin for both probe and chat",
  { timeout: 30000 },
  async () => {
    const env = {
      CODESPACE_NAME: "axiom-proxy-test",
      GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      GROQ_API_KEY: "proxy-test-placeholder-not-real",
      GROQ_ENABLED: "true",
      API_PORT: "3001",
    };
    const origin = "https://axiom-proxy-test-5173.app.github.dev";
    let calls = 0;
    const api = createServer({
      env,
      client: {
        responses: {
          create: async () => {
            calls++;
            return {
              status: "completed",
              output: [],
              output_text: "Mock Groq reply through the real proxy.",
            };
          },
        },
      },
    });
    await new Promise((resolve, reject) => {
      api.once("error", reject);
      api.listen(3001, "127.0.0.1", resolve);
    });
    let web;
    try {
      const config = previewServerConfig(env);
      assert.equal(config.proxy["/api"].target, "http://127.0.0.1:3001");
      assert.deepEqual(config.allowedHosts, [
        "axiom-proxy-test-5173.app.github.dev",
      ]);
      web = await createViteServer({
        configFile: false,
        server: { ...config, host: "127.0.0.1", hmr: false },
        logLevel: "silent",
      });
      await web.listen();
      const post = (route, requestOrigin, payload = {}, extra = {}) =>
        fetch(`http://127.0.0.1:5173/api/${route}`, {
          method: "POST",
          headers: {
            origin: requestOrigin,
            "content-type": "application/json",
            ...extra,
          },
          body: JSON.stringify(payload),
        });
      let res = await post("status", origin);
      assert.equal(res.status, 200);
      const status = await res.json();
      assert.equal(status.status, "ready");
      assert.match(
        status.message,
        /server reachable; preview origin accepted/i,
      );
      assert.equal(calls, 0, "connection checks must never invoke Groq");
      res = await post("chat", origin, {
        requestId: "proxy-regression",
        today: "2026-11-01",
        tasks: [],
        messages: [{ role: "user", content: "Hello through Codespaces" }],
      });
      assert.equal(res.status, 200);
      assert.equal(
        (await res.json()).content,
        "Mock Groq reply through the real proxy.",
      );
      assert.equal(calls, 1);
      for (const route of ["status", "chat"]) {
        res = await post(
          route,
          "https://foreign-5173.app.github.dev",
          {},
          {
            "x-forwarded-host": "foreign-5173.app.github.dev",
            "x-forwarded-proto": "https",
          },
        );
        assert.equal(res.status, 403);
        assert.match((await res.json()).error, /Request origin is not allowed/);
      }
      res = await post("status", "http://127.0.0.1:5173");
      assert.equal(res.status, 200);
      assert.equal(
        calls,
        1,
        "rejected origins and successful probes must not invoke Groq",
      );
    } finally {
      await web?.close();
      api.closeAllConnections();
      await new Promise((resolve) => api.close(resolve));
    }
  },
);
