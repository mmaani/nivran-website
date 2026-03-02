import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { rows } = await db.query<{ now: string }>("select now() as now");
  return NextResponse.json({ ok: true, now: rows[0]?.now ?? null });
}
