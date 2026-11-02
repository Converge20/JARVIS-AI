# Codespaces origin validation and connection feedback

> Browser voice and safe Markdown are now implemented in [Phase 4](PHASE-4-VOICE.md), which supersedes the earlier voice-disabled notes below. The Groq setup and strict origin/proxy protections remain current.

## Cause and fix

The former backend fallback compared `Origin` against `http://${Host}`. An authenticated Codespaces page is served over HTTPS while the Vite/API hop is HTTP, and its Host may be rewritten. Without a correctly persisted manual `AXIOM_ALLOWED_ORIGIN`, that legitimate browser request failed before Groq was contacted. A copied origin with a trailing slash could also mismatch the browser's serialized origin.

The old Check connection action used GET `/api/status`, which bypassed chat's origin validation, and quietly replaced a small message with often-identical text. A successful GET did not establish that chat's POST path would work.

The fix shares server-only origin configuration between Vite and the backend:

- Derive the exact HTTPS frontend origin from trusted `CODESPACE_NAME`, `AXIOM_WEB_PORT` (default 5173) and `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` (default `app.github.dev`). An explicit `--port` in the combined dev runner sets the same port for both processes. Strict Vite port selection avoids silently using a different port.
- Vite allows the exact derived hostname and proxies `/api` to loopback `127.0.0.1:3001` (or configured `API_PORT`). No wildcard host setting is introduced.
- The backend accepts only exact serialized origins from that metadata, optional explicitly configured HTTPS origins, or known local loopback frontend/backend ports. `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` do not grant permission. Cross-site Fetch Metadata, malformed/null/multiple origins, different Codespaces, wrong forwarded ports, suffix attacks and wildcard configuration are rejected. The socket's local port, unlike the request Host, is trusted for direct local backend development.
- `AXIOM_ALLOWED_ORIGIN` is an optional **additional** exact origin, rather than a replacement that can suppress the current Codespace's metadata-derived origin. A root trailing slash is normalized in that configuration only. Paths, queries, credentials and wildcard values fail closed. Remove stale overrides when they are no longer needed.
- Check connection now sends an uncached JSON POST to `/api/status`, using the same validation and Vite proxy as chat. GET remains a configuration-only health route for existing tooling. The visible feedback panel displays progress, a disabled checking button, a fresh timestamp, and the returned configuration/error result. Checks time out after eight seconds, prevent duplicate clicks and cannot overwrite a newer conversation's connection result.

A probe verifies **application server reachability, preview-origin acceptance and server configuration**, not Groq authentication. It never calls Groq or uses quota. Only a real successful AI reply verifies inference. Existing key validation, task confirmations, API limits, Groq-only endpoint, server credential isolation and disabled microphone/voice remain intact. SDK requests still use `https://api.groq.com/openai/v1/responses`; the existing intercepted-SDK test asserts that exact endpoint and credential handling.

## Update your existing Codespace

In its browser terminal, stop the old preview with **Control+C**, then run:

```bash
git switch feat/axiom-neural-interface
git pull --ff-only origin feat/axiom-neural-interface
npm ci
export GROQ_ENABLED=true
# Override any stale manual value from a terminal or .env; metadata is automatic.
export AXIOM_ALLOWED_ORIGIN=
npm run dev -- --port 5173 --strictPort
```

Open **Ports → 5173 → Open in Browser**, with visibility **Private**. Keep backend port 3001 unforwarded. Normal Codespaces previews no longer need `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` or a manually copied origin. If you previously exported a broad/stale Vite host setting, unset it before starting. No CORS allow-all or public tunnel is needed.

Select **Check connection**. Expect a visible loading state, then a timestamp and `Application server reachable; preview origin accepted.` followed by the Groq configuration state. `Configuration required` means the server did not receive `GROQ_API_KEY`; verify that the existing Codespaces secret is authorized for this repository, then stop and reopen that same Codespace and start a new terminal. Never print or paste the key. `AI requests are disabled` means `GROQ_ENABLED=true` was not set in the server's environment.

Once configured, send **“Explain compound interest in simple terms.”** The brain should show Analyzing during the request, then a real reply and **Groq connected**. A model/authentication/rate-limit/network error after origin acceptance is a separate provider problem and remains visible. No origin workaround can verify or repair an invalid API key. Keep your Groq organisation on the Free Plan.

For a non-Codespaces custom private HTTPS preview, set `AXIOM_ALLOWED_ORIGIN` to that one exact origin. Do not use `*`, `.app.github.dev`, `https://*.app.github.dev`, a list of arbitrary domains or a request-supplied forwarding header. Public/multi-user hosting would still require authentication and a separate review; this change does not make an exposed backend safe.

## Regression coverage and limitations

- Pure origin tests cover the exact Codespaces origin, Host rewriting, custom forwarding domains/ports, explicit origins/trailing slash, local development, invalid configuration, missing/null/multiple origins, foreign origins and spoofed forwarding headers.
- A real integration test runs **Vite on 5173 → Node API on 3001** and submits a Codespaces-style HTTPS Origin over the internal HTTP hop. Both POST probe and chat succeed with a mocked Groq reply. Foreign POST probes/chat requests are rejected before the mock provider runs; probes never invoke inference.
- React/service/browser tests cover POST probe semantics, visible loading/result timestamps, duplicate-click protection, origin errors, backend failures and ordinary application workflows.
- Provider URL/authentication tests keep real SDK traffic intercepted; no live credentials or paid calls are used. The current Codex environment does not access the user's Codespace or its secret. The actual GitHub authenticated forwarding layer and first real Groq authentication must still be checked in that Codespace.
- Keep forwarded port 5173 private in GitHub; the application cannot enforce the port-visibility setting. The existing orange-pixel CI timeout, if repeated, is reported independently rather than bypassed or hidden.

## Validation results

- Full and production-only `npm audit`: **0 vulnerabilities**.
- `npm test`: **61 passed** (35 React/service/anatomy tests, plus 26 Node tests including the real 5173 → 3001 proxy regression).
- `npm run build`: passed, with the existing lazy Three.js chunk-size advisory.
- Full local Chromium suite: **13 passed**, including two new connection-control tests and all existing dashboard/task/brain checks.
- Targeted strict TypeScript check of `vite.config.ts`, `git diff --check`, and client-bundle provider-endpoint/test-credential checks: passed.
- No live inference call, key access, public deployment, or merge performed. GitHub Actions results for the pushed commit are recorded separately in Draft PR #2.
