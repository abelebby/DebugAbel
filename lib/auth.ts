import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, readSessionCookie, type Session } from "./session";
import { agentTokenOk } from "./local-only";

/** Session for the current request, or null when not logged in. */
export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  return readSessionCookie(store.get(SESSION_COOKIE)?.value);
}

export type ReadAuth = Session | { agent: true };

/**
 * Auth for the read-only GET routes the debugging-agent MCP tools call
 * (list_bugs, get_bug, and the attachment fetch get_bug uses for
 * screenshots). A normal session still works, exactly as before. Without
 * one, the same boundary already used for POST /api/bugs applies: the
 * request must present a valid AGENT_TOKEN (lib/local-only.ts) - required,
 * no fallback, now that the app is hosted publicly rather than bound to
 * loopback. This never grants write access - only the routes that call this
 * helper are GETs.
 */
export async function currentSessionOrLocalAgent(headers: Headers): Promise<ReadAuth | null> {
  const session = await currentSession();
  if (session) return session;
  if (agentTokenOk(headers)) return { agent: true };
  return null;
}

/**
 * Server-side auth gate for route handlers. The middleware already blocks
 * unauthenticated requests, but every mutation re-checks here too - the UI
 * hiding a button is never the only protection.
 */
export async function requireSession(): Promise<Session | NextResponse> {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return session;
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** Best-effort ownership check: display name recorded on the bug's reporter. */
export function sameReporter(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
