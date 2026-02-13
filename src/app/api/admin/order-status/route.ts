import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";

export async function POST(req: Request) {
  const guard = requireAdmin(req);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });

  return NextResponse.json({ ok: true, updated: body });
}
