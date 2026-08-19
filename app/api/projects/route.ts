import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, features } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, optionalString, requiredString } from "@/lib/validate";
import { isUniqueViolation } from "@/lib/db-errors";

export const runtime = "nodejs";

// TEMPORARY DIAGNOSTIC - walks error.cause to surface the real driver/DB
// message instead of the generic "Internal error", so it shows up in the
// browser/curl response body without needing to dig through Netlify's log UI.
// Remove this function and its one call site once the issue is found.
function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const message = (current as { message?: unknown }).message;
    const code = (current as { code?: unknown }).code;
    if (typeof message === "string") parts.push(code ? `${message} (code: ${code})` : message);
    current = (current as { cause?: unknown }).cause;
  }
  return parts.length ? parts.join(" <- caused by <- ") : String(error);
}

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await db.query.projects.findMany({
    orderBy: [projects.name],
    with: { features: { orderBy: [features.name] } },
  });
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const name = requiredString(body.name, "name", { max: 120 });
    const description = optionalString(body.description, "description", { max: 2000 }) ?? "";
    const [created] = await db.insert(projects).values({ name, description }).returning();
    return NextResponse.json({ project: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "A project with that name already exists." }, { status: 409 });
    }
    console.error("[POST /api/projects]", error);
    // TEMPORARY DIAGNOSTIC - remove once the Supabase connection issue is found.
    return NextResponse.json(
      { error: "Internal error", debug: describeError(error) },
      { status: 500 },
    );
  }
}
