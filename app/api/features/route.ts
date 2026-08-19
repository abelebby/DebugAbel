import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { features, projects } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, requiredString } from "@/lib/validate";
import { isUniqueViolation } from "@/lib/db-errors";

export const runtime = "nodejs";

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
    const projectId = requiredString(body.project_id, "project_id", { max: 64 });
    const name = requiredString(body.name, "name", { max: 120 });
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { id: true },
    });
    if (!project) return NextResponse.json({ error: "Unknown project_id." }, { status: 400 });

    const [created] = await db.insert(features).values({ projectId, name }).returning();
    return NextResponse.json({ feature: created }, { status: 201 });
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
    console.error("[POST /api/features]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
