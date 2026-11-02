import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
// This module is server configuration only; it never enters the browser bundle.
import { previewServerConfig } from "./server/vite-config.mjs";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: previewServerConfig({
    ...loadEnv(mode, process.cwd(), [
      "API_PORT",
      "AXIOM_",
      "CODESPACE_NAME",
      "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN",
    ]),
    ...process.env,
  }),
}));
