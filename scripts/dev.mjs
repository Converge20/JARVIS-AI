import { spawn } from "node:child_process";
// Keep an explicit --port override consistent with the backend's trusted preview origin.
const args = process.argv.slice(2);
const portArg =
  args.find((arg) => arg.startsWith("--port="))?.slice(7) ??
  (args.includes("--port") ? args[args.indexOf("--port") + 1] : undefined);
const childEnv = {
  ...process.env,
  ...(portArg ? { AXIOM_WEB_PORT: portArg } : {}),
};
const api = spawn(
  process.execPath,
  ["--env-file-if-exists=.env", "server/index.mjs"],
  { stdio: "inherit", env: childEnv },
);
const web = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: childEnv },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of [api, web]) child.on("exit", (code) => stop(code ?? 1));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
