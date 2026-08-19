import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, optionalString, requiredString } from "@/lib/validate";
import { isUniqueViolation } from "@/lib/db-errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = requiredString(body.name, "name", { max: 120 });
    if (body.description !== undefined) {
      updates.description = optionalString(body.description, "description", { max: 2000 }) ?? "";
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }
    const updated = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id)) // primary key only
      .returning();
    if (updated.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project: updated[0] });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "A project with that name already exists." }, { status: 409 });
    }
    console.error("[PATCH /api/projects/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const deleted = await db
    .delete(projects)
    .where(eq(projects.id, id)) // primary key only
    .returning({ id: projects.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
