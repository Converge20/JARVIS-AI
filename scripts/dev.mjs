import { spawn } from "node:child_process";
const api = spawn(
  process.execPath,
  ["--env-file-if-exists=.env", "server/index.mjs"],
  { stdio: "inherit" },
);
const web = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit" },
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
