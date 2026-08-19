import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionCookie } from "@/lib/session";
import { agentTokenOk } from "@/lib/local-only";

/**
 * SECURITY: this middleware runs BEFORE every route in the app. The matcher
 * below is a deny-by-default list: everything except Next.js's own static
 * assets goes through this function, and anything that is not explicitly
 * allowed requires a valid session.
 *
 * The exceptions are the agent-reachable paths below. None of them have a
 * login, so each instead requires a valid AGENT_TOKEN (see lib/local-only.ts)
 * sent as the `x-agent-token` header:
 *   - POST /api/bugs             the MCP agent's log_bug tool (write)
 *   - GET  /api/bugs             the MCP agent's list_bugs tool (read)
 *   - GET  /api/bugs/:id         the MCP agent's get_bug tool (read)
 *   - GET  /api/attachments/:id  get_bug fetching a screenshot's bytes (read)
 * Every one of these is re-checked again inside its own route handler
 * (see lib/auth.ts's currentSessionOrLocalAgent) - this middleware is not
 * the only gate, exactly like the original POST /api/bugs bypass.
 */

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

const BUG_BY_ID_GET = /^\/api\/bugs\/[^/]+$/;
const ATTACHMENT_BY_ID_GET = /^\/api\/attachments\/[^/]+$/;

function isAgentReachable(pathname: string, method: string): boolean {
  if (pathname === "/api/bugs" && (method === "POST" || method === "GET")) return true;
  if (method === "GET" && BUG_BY_ID_GET.test(pathname)) return true;
  if (method === "GET" && ATTACHMENT_BY_ID_GET.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (isAgentReachable(pathname, request.method)) {
    const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
    if (session) return NextResponse.next();
    if (agentTokenOk(request.headers)) {
      return NextResponse.next();
    }
    return json401();
  }

  const session = await readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) return json401();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

function json401() {
  return new NextResponse(JSON.stringify({ error: "Not authenticated" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

export const config = {
  // Everything except Next's build output, the favicon and public files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
