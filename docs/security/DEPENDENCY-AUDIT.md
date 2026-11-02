# Dependency vulnerability review — 1 November 2026

## Findings and exposure

The original `npm audit` reports **three affected package entries: one moderate and two critical**. Those entries do not represent three independent vulnerabilities: Vitest inherits severity from its transitive dependencies. The underlying findings comprise two tinypool advisories and two mocker advisories.

| Dependency before fix | Path / directness | Findings | AXIOM exposure |
| --- | --- | --- | --- |
| `vitest@3.2.7` | Direct **devDependency** | Critical aggregate through tinypool; also affected by mocker file-read advisory | Test runner only; not imported by the React app or Node AI backend |
| `tinypool@1.1.1` | `vitest → tinypool`, transitive dev dependency | Critical prototype-pollution gadgets affecting worker construction and `run()` options; potential worker code execution | Development/CI Node workers, requiring a separate means of polluting object prototypes and applicable worker invocation; not a remotely callable AXIOM API route |
| `@vitest/mocker@3.2.7` | `vitest → @vitest/mocker`, transitive dev dependency | Moderate redirect-mock path traversal/file read and manual-mock code injection | Development mock server/plugin surfaces. AXIOM uses `vitest run` with Node/jsdom and does not install the standalone `mockerPlugin`/`interceptorPlugin` in Vite or enable Vitest browser mode. Its browser suite uses Playwright instead |

Both full and production-only dependency trees were inspected. **No finding affects AXIOM's production dependency graph.** The development dependencies can still be present on disk in a full Codespaces install; a devDependency label alone does not remove a risk when its tooling executes. In particular, successful exploitation in a development/test process could access that process's files and privileges. No exploitation or compromise was observed or tested, and absence of another reported pollution primitive is not a guarantee that one cannot exist.

The mocker advisories require their vulnerable registration paths to be configured and reachable. The normal AXIOM Vite config includes only the React plugin, so these particular mock-server endpoints are not part of AXIOM's dev preview. A public dev port or custom mocker plugin configuration could change that exposure. Keep previews private.

Primary sources:

- [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3): tinypool worker-option prototype-pollution gadget; fixed in 2.1.1.
- [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr): additional `run()` option gadget; fixed in 2.1.2. A move to 2.1.1 alone would not address both findings.
- [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9): mock redirect file read; fixed in Vitest/mocker 4.1.11. Older 3.x is not maintained for this fix.
- [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8): manual-mock source injection; backported to mocker 4.1.12. Version 4.1.11 alone is insufficient.

## Remediation and compatibility decision

There is no published Vitest 3 patch that resolves every finding. Before changing dependencies, the major-upgrade trade-off was explained: **Vitest 3 → 4.1.12 changes development test-runner internals and some mocking/worker behaviour**, while supporting the existing Node 22.12+/24 and Vite 7 setup. The maintained 4.1.12 line is sufficient; the newer Vitest 5 major is unnecessary.

`package.json` now requires `vitest: ^4.1.12`. The committed npm lockfile resolves:

- `vitest@4.1.12` and matching `@vitest/*` packages, including `@vitest/mocker@4.1.12`.
- **No tinypool**: Vitest 4 no longer depends on it. Both critical gadgets are removed from the installed tree rather than overridden across an incompatible transitive major.
- Existing Vite `7.3.7`, React, Three.js, OpenAI SDK and all other production package versions are unchanged. The dashboard and backend source code are unchanged.

No `npm audit fix --force`, transitive version overrides, audit suppression, npm CLI upgrade, or unnecessary production dependency upgrades were used. Existing tests required no Vitest migration edits.

## Verification

Audit evidence from the npm registry is committed beside this report:

- [Before: full audit](npm-audit-before.json): 3 affected package entries (1 moderate, 2 critical).
- [After: full audit](npm-audit-after.json): **0 vulnerabilities**.
- [After: production-only audit](npm-audit-production.json): **0 vulnerabilities**.

Commands:

```bash
npm ci
npm audit
npm audit --omit=dev
npm ls vitest @vitest/mocker tinypool vite --all
npm test
npm run build
npm run test:e2e
```

`npm test`: **43 passed** (32 React/service/anatomy tests under Vitest 4 and 11 Node backend tests). `npm run build`: passed, with the existing lazy Three.js chunk-size advisory. A clean `npm ci` verified lockfile reproducibility and reported zero vulnerabilities. The complete local Playwright Chromium suite passed **11/11**, including dashboard/tasks, mocked AI commands, actual anatomical WebGL pixels and orange signals, all six states, no-WebGL fallback, reduced motion, context recovery and effects-off inspection. GitHub Actions results for the pushed commit are reported separately in Draft PR #2.

**Unresolved npm audit vulnerabilities: none at the time of this review.** This is a dependency-advisory check, not a claim that the entire application is free of security defects. The previously reported orange-pixel browser-test timeout is a separate rendering/test observation, not an npm vulnerability; any repeat is reported separately rather than hidden or weakened to clear the security audit.

OpenAI remains opt-in and is not activated by this change. All automated AI interactions use mocks; browser-test servers clear the key and explicitly disable OpenAI. No API credentials, paid calls, microphone access, public deployment or merges are involved.
