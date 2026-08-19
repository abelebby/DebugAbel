import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bugs } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { getBug } from "@/lib/bugs";
import { ValidationError, status as parseStatus } from "@/lib/validate";

export const runtime = "nodejs";

/** PATCH /api/bugs/:id/status - any logged-in user may move any bug's status. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  let body: { status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const next = parseStatus(body.status);
    const updated = await db
      .update(bugs)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(bugs.id, id)) // primary key only
      .returning({ id: bugs.id });
    if (updated.length === 0) return NextResponse.json({ error: "Bug not found" }, { status: 404 });
    return NextResponse.json({ bug: await getBug(id) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[PATCH /api/bugs/:id/status]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
