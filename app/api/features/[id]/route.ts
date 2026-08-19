import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { features } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, requiredString } from "@/lib/validate";
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
    const name = requiredString(body.name, "name", { max: 120 });
    const updated = await db
      .update(features)
      .set({ name })
      .where(eq(features.id, id)) // primary key only
      .returning();
    if (updated.length === 0) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }
    return NextResponse.json({ feature: updated[0] });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "That feature already exists in this project." },
        { status: 409 },
      );
    }
    console.error("[PATCH /api/features/:id]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const deleted = await db
    .delete(features)
    .where(eq(features.id, id)) // primary key only
    .returning({ id: features.id });
  if (deleted.length === 0) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
