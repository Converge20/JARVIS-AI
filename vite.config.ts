import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${loadEnv(mode, process.cwd(), "API_PORT").API_PORT || "3001"}`,
        changeOrigin: false,
      },
    },
    headers: { "Permissions-Policy": "microphone=(), camera=()" },
  },
}));
