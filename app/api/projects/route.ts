import { NextResponse } from "next/server";
import { db } from "@/db";
import { projects, features } from "@/db/schema";
import { currentSession } from "@/lib/auth";
import { ValidationError, optionalString, requiredString } from "@/lib/validate";
import { isUniqueViolation } from "@/lib/db-errors";

export const runtime = "nodejs";

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
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
