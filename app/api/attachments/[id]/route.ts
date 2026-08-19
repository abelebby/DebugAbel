import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { currentSessionOrLocalAgent } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/attachments/:id - streams the bytea back. Login required, OR a
 * loopback-local request (the debugging agent's get_bug tool fetching a
 * screenshot) - see lib/auth.ts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await currentSessionOrLocalAgent(request.headers);
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const row = await db.query.attachments.findFirst({ where: eq(attachments.id, id) });
  if (!row) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "content-type": row.mimetype,
      // inline so images preview, but never let the browser sniff a new type
      "content-disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=3600",
    },
  });
}
