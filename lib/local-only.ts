/**
 * Protection for the four agent-reachable routes (POST/GET /api/bugs,
 * GET /api/bugs/:id, GET /api/attachments/:id) that the MCP agent calls with
 * no login.
 *
 * Now that the app is deployed on the public internet (Netlify) rather than
 * bound to 127.0.0.1 on a single machine, network position proves nothing -
 * `isLocalRequest` below is kept only as a harmless utility (and would still
 * be meaningful again if this were ever run purely locally), but it is no
 * longer part of the auth decision in middleware.ts / lib/auth.ts.
 *
 * The real (and now only) boundary is AGENT_TOKEN: a required shared secret
 * (see lib/env.ts's agentToken(), enforced at boot in instrumentation.ts) that
 * the MCP server must send as `x-agent-token` on every call. There is no
 * fallback - if it's ever unset, the app refuses to start at all, so
 * agentTokenOk()'s "no token configured" branch below should never actually
 * be reachable in a running deployment.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "::ffff:127.0.0.1"]);

function hostnameOf(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) return trimmed.slice(0, trimmed.indexOf("]") + 1).toLowerCase();
  return trimmed.split(":")[0].toLowerCase();
}

function isLoopbackHost(value: string | null): boolean {
  if (!value) return true; // header absent is fine
  return value.split(",").every((part) => LOOPBACK.has(hostnameOf(part)));
}

export function isLocalRequest(headers: Headers): boolean {
  const host = headers.get("host");
  if (!host || !LOOPBACK.has(hostnameOf(host))) return false;
  if (!isLoopbackHost(headers.get("x-forwarded-host"))) return false;
  // next start populates x-forwarded-for from the socket's remote address.
  if (!isLoopbackHost(headers.get("x-forwarded-for"))) return false;
  if (!isLoopbackHost(headers.get("x-real-ip"))) return false;
  if (headers.get("forwarded")) return false;
  return true;
}

/**
 * Optional shared secret for the agent path. Returns true when AGENT_TOKEN is
 * not configured (the default, localhost-only setup).
 */
export function agentTokenOk(headers: Headers): boolean {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) return true;
  const provided = headers.get("x-agent-token");
  if (!provided || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
