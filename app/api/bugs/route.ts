import { NextResponse } from "next/server";
import { db } from "@/db";
import { bugs } from "@/db/schema";
import { currentSession, currentSessionOrLocalAgent } from "@/lib/auth";
import { getBug, listBugs, resolveProjectAndFeature, insertAttachments } from "@/lib/bugs";
import {
  ValidationError,
  bugType,
  optionalString,
  parseImages,
  requiredString,
  severity,
  status,
} from "@/lib/validate";

export const runtime = "nodejs";

/**
 * GET /api/bugs - list with optional filters. Login required, OR a valid
 * AGENT_TOKEN (the debugging agent's list_bugs tool) - same bypass as POST
 * below, extended to this read (middleware + here; see lib/auth.ts).
 */
export async function GET(request: Request) {
  const auth = await currentSessionOrLocalAgent(request.headers);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  try {
    const rows = await listBugs({
      projectId: params.get("project") ?? undefined,
      featureId: params.get("feature") ?? undefined,
      bugType: params.get("bug_type") ? bugType(params.get("bug_type")) : undefined,
      severity: params.get("severity") ? severity(params.get("severity")) : undefined,
      status: params.get("status") ? status(params.get("status")) : undefined,
    });
    return NextResponse.json({ bugs: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/bugs - the ONE creation path, shared by the web form and the MCP
 * agent. Requests with a session are recorded as source "web" and reported
 * under the logged-in display name; requests without one must carry a valid
 * AGENT_TOKEN (middleware + lib/auth.ts) and are recorded as source "agent".
 */
export async function POST(request: Request) {
  const session = await currentSession();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { projectId, featureId } = await resolveProjectAndFeature(body);
    const images = parseImages(body.images);

    const source = session ? "web" : "agent";
    const reporter = session
      ? session.name
      : requiredString(body.reporter ?? body.reporter_name, "reporter", { max: 60 });

    const values = {
      projectId,
      featureId,
      title: requiredString(body.title, "title", { max: 200 }),
      description: requiredString(body.description, "description", { max: 20_000 }),
      stepsToReproduce: requiredString(body.steps_to_reproduce, "steps_to_reproduce", {
        max: 20_000,
      }),
      bugType: bugType(body.bug_type),
      severity: severity(body.severity),
      status: body.status === undefined ? ("Open" as const) : status(body.status),
      reporter,
      environment: optionalString(body.environment, "environment", { max: 500 }),
      source: source as "web" | "agent",
    };

    const [created] = await db.insert(bugs).values(values).returning();
    await insertAttachments(created.id, images);

    return NextResponse.json({ bug: await getBug(created.id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[/api/bugs]", error);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
