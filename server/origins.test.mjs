import { test } from "node:test";
import assert from "node:assert/strict";
import { configuredBrowserOrigins, requestOriginAllowed } from "./origins.mjs";
const env = {
  CODESPACE_NAME: "axiom-secure-demo",
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
};
const origin = "https://axiom-secure-demo-5173.app.github.dev";
const req = (originValue, headers = {}) => ({
  headers: { origin: originValue, host: "127.0.0.1:3001", ...headers },
  socket: { localPort: 3001 },
});
test("derives one exact HTTPS Codespaces frontend origin, independent of proxy Host rewrites", () => {
  assert.deepEqual(configuredBrowserOrigins(env), [origin]);
  assert.equal(requestOriginAllowed(req(origin), env), true);
  assert.equal(
    requestOriginAllowed(
      req(origin, {
        host: "localhost:5173",
        "x-forwarded-host": "irrelevant.invalid",
        "x-forwarded-proto": "http",
      }),
      env,
    ),
    true,
  );
});
test("rejects foreign preview domains, wrong ports, protocol mismatches and forwarding-header spoofing", () => {
  for (const bad of [
    "https://other-codespace-5173.app.github.dev",
    "https://axiom-secure-demo-3001.app.github.dev",
    "http://axiom-secure-demo-5173.app.github.dev",
    "https://axiom-secure-demo-5173.app.github.dev.evil.example",
    "https://evil.example",
    "http://evil.example:5173",
  ]) {
    assert.equal(
      requestOriginAllowed(
        req(bad, {
          "x-forwarded-host": new URL(bad).host,
          "x-forwarded-proto": new URL(bad).protocol.slice(0, -1),
          host: new URL(bad).host,
        }),
        env,
      ),
      false,
      bad,
    );
  }
  assert.equal(
    requestOriginAllowed(req(origin, { "sec-fetch-site": "cross-site" }), env),
    false,
  );
});
test("rejects missing, null, multiple or malformed Origin headers", () => {
  for (const bad of [
    undefined,
    "null",
    `${origin}/`,
    `${origin}/path`,
    `${origin}, https://evil.example`,
    ["https://evil.example", origin],
  ])
    assert.equal(requestOriginAllowed(req(bad), env), false);
});
test("supports configured Codespaces forwarding domains and web ports without wildcard trust", () => {
  const configured = {
    ...env,
    GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "preview.example.org",
    AXIOM_WEB_PORT: "5180",
  };
  assert.equal(
    requestOriginAllowed(
      req("https://axiom-secure-demo-5180.preview.example.org"),
      configured,
    ),
    true,
  );
  assert.equal(requestOriginAllowed(req(origin), configured), false);
});
test("accepts exact explicit origins, normalizes a trailing slash, and retains the current trusted Codespace", () => {
  const configured = {
    ...env,
    AXIOM_ALLOWED_ORIGIN: "https://private-preview.example.org/",
  };
  assert.equal(
    requestOriginAllowed(
      req("https://private-preview.example.org"),
      configured,
    ),
    true,
  );
  assert.equal(requestOriginAllowed(req(origin), configured), true);
  assert.equal(
    requestOriginAllowed(req("https://other.example.org"), configured),
    false,
  );
});
test("refuses broad, credential-bearing and path-bearing explicit origins", () => {
  for (const bad of [
    "*",
    "https://*.app.github.dev",
    "https://user:password@example.org",
    "https://example.org/path",
    "https://example.org?x=1",
    "http://public.example.org",
    "https://one.example,https://two.example",
  ])
    assert.throws(
      () => configuredBrowserOrigins({ AXIOM_ALLOWED_ORIGIN: bad }),
      /AXIOM_ALLOWED_ORIGIN/,
    );
  assert.throws(
    () => configuredBrowserOrigins({ ...env, CODESPACE_NAME: "evil.example" }),
    /Codespaces/,
  );
});
test("local development allows only known frontend and actual backend socket ports", () => {
  for (const ok of [
    "http://localhost:5173",
    "http://127.0.0.1:3001",
    "http://[::1]:5173",
  ])
    assert.equal(requestOriginAllowed(req(ok), {}), true);
  assert.equal(requestOriginAllowed(req("http://localhost:8999"), {}), false);
  assert.equal(
    requestOriginAllowed(
      req("http://attacker.example:3001", { host: "attacker.example:3001" }),
      {},
    ),
    false,
  );
});
