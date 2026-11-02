import { configuredBrowserOrigins, webPort } from "./origins.mjs";
export function previewServerConfig(env) {
  return {
    port: webPort(env),
    strictPort: true,
    allowedHosts: configuredBrowserOrigins(env).map(
      (origin) => new URL(origin).hostname,
    ),
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${env.API_PORT || "3001"}`,
        changeOrigin: false,
      },
    },
    headers: { "Permissions-Policy": "microphone=(), camera=()" },
  };
}
