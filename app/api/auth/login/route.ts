import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { authPassword } from "@/lib/env";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a comparison so the timing does not leak the length.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  let body: { name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json({ error: "Enter your name (2-60 characters)." }, { status: 400 });
  }

  // NOTE: never echo the expected password (or any part of it) back to the client.
  if (!constantTimeEquals(password, authPassword())) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ name });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await createSessionCookie(name),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
