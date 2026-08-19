import { NextResponse } from "next/server";
import { currentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ name: session.name });
}
