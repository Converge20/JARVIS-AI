// Trust server configuration / Codespaces metadata, never request forwarding headers.
export const DEFAULT_WEB_PORT = 5173;
export function webPort(env = process.env) {
  const port = Number(env.AXIOM_WEB_PORT || DEFAULT_WEB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("AXIOM_WEB_PORT must be a valid TCP port.");
  return port;
}
const loopback = (hostname) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
const hostnameValid = (hostname) =>
  hostname.length <= 253 &&
  hostname
    .split(".")
    .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
function configuredOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "AXIOM_ALLOWED_ORIGIN must be one exact HTTPS origin (or local HTTP origin).",
    );
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    url.hostname.includes("*") ||
    (!loopback(url.hostname) && !hostnameValid(url.hostname)) ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && loopback(url.hostname))
    )
  )
    throw new Error(
      "AXIOM_ALLOWED_ORIGIN must be one exact HTTPS origin (or local HTTP origin), without credentials, a path, query or wildcard.",
    );
  return url.origin;
}
export function configuredBrowserOrigins(env = process.env) {
  const origins = new Set();
  if (env.CODESPACE_NAME) {
    const domain =
      env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || "app.github.dev";
    const host = `${env.CODESPACE_NAME}-${webPort(env)}.${domain}`;
    if (
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(env.CODESPACE_NAME) ||
      !hostnameValid(host)
    )
      throw new Error(
        "Invalid Codespaces preview metadata. Check CODESPACE_NAME and GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN.",
      );
    origins.add(`https://${host.toLowerCase()}`);
  }
  if (env.AXIOM_ALLOWED_ORIGIN?.trim())
    origins.add(configuredOrigin(env.AXIOM_ALLOWED_ORIGIN.trim()));
  return [...origins];
}
export function requestOriginAllowed(req, env = process.env) {
  const origin = req.headers.origin;
  if (
    typeof origin !== "string" ||
    req.headers["sec-fetch-site"] === "cross-site"
  )
    return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  // Reject malformed/non-serialized Origin headers, null, paths and multiple origins.
  if (parsed.origin !== origin) return false;
  const allowed = new Set(configuredBrowserOrigins(env));
  // Local Vite and direct backend access. localPort comes from the socket, not Host.
  for (const port of [webPort(env), req.socket?.localPort]) {
    if (!port) continue;
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      allowed.add(`http://${host}:${port}`);
  }
  return allowed.has(origin);
}
