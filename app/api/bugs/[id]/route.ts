import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bugs } from "@/db/schema";
import { currentSession, currentSessionOrLocalAgent, sameReporter } from "@/lib/auth";
import { getBug, resolveProjectAndFeature } from "@/lib/bugs";
import {
  ValidationError,
  bugType,
  optionalString,
  requiredString,
  severity,
} from "@/lib/validate";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/bugs/:id - full detail. Login required, OR a loopback-local
 * request (the debugging agent's get_bug tool) - see lib/auth.ts.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await currentSessionOrLocalAgent(request.headers);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const bug = await getBug((await params).id);
  if (!bug) return NextResponse.json({ error: "Bug not found" }, { status: 404 });
  return NextResponse.json({ bug });
}

/**
 * PATCH /api/bugs/:id - edit bug fields.
 * Authorization: only the person recorded as the bug's reporter may edit it.
 * With a shared team login this is a best-effort display-name match, exactly as
 * specified - but it is still enforced here on the server, not just in the UI.
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await db.query.bugs.findFirst({ where: eq(bugs.id, id) });
  if (!existing) return NextResponse.json({ error: "Bug not found" }, { status: 404 });

  if (!sameReporter(existing.reporter, session.name)) {
    return NextResponse.json(
      { error: `Only the reporter (${existing.reporter}) can edit this bug.` },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.title !== undefined) updates.title = requiredString(body.title, "title", { max: 200 });
    if (body.description !== undefined) {
      updates.description = requiredString(body.description, "description", { max: 20_000 });
    }
    if (body.steps_to_reproduce !== undefined) {
      updates.stepsToReproduce = requiredString(body.steps_to_reproduce, "steps_to_reproduce", {
        max: 20_000,
      });
    }
    if (body.bug_type !== undefined) updates.bugType = bugType(body.bug_type);
    if (body.severity !== undefined) updates.severity = severity(body.severity);
    if (body.environment !== undefined) {
      updates.environment = optionalString(body.environment, "environment", { max: 500 });
    }
    if (body.project_id !== undefined || body.feature_id !== undefined) {
      const resolved = await resolveProjectAndFeature({
        project_id: body.project_id ?? existing.projectId,
        feature_id: body.feature_id ?? existing.featureId,
      });
      updates.projectId = resolved.projectId;
      updates.featureId = resolved.featureId;
    }

    // WHERE targets the primary key only - a request can never touch another row.
    await db.update(bugs).set(updates).where(eq(bugs.id, id));
    return NextResponse.json({ bug: await getBug(id) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[PATCH /api/bugs/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/bugs/:id - any logged-in team member may delete a bug (open
 * team decision, not restricted to the original reporter - unlike PATCH
 * above). Still requires a valid session, and the WHERE targets the primary
 * key only, exactly like PATCH.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await db.query.bugs.findFirst({ where: eq(bugs.id, id) });
  if (!existing) return NextResponse.json({ error: "Bug not found" }, { status: 404 });

  await db.delete(bugs).where(eq(bugs.id, id));
  return NextResponse.json({ ok: true });
}
