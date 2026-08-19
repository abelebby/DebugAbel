import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bugs, comments } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, requiredString } from "@/lib/validate";

export const runtime = "nodejs";

/** POST /api/bugs/:id/comments - any logged-in user may comment. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const bug = await db.query.bugs.findFirst({ where: eq(bugs.id, id), columns: { id: true } });
  if (!bug) return NextResponse.json({ error: "Bug not found" }, { status: 404 });

  let body: { body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const text = requiredString(body.body, "body", { max: 10_000 });
    // Author always comes from the session, never from the request body.
    const [created] = await db
      .insert(comments)
      .values({ bugId: id, author: session.name, body: text })
      .returning();
    return NextResponse.json({ comment: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/bugs/:id/comments]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
