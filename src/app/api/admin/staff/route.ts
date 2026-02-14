import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { listStaff, upsertStaff } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized(req: Request, status: number, error: string) {
  const accept = req.headers.get("accept") || "";
  const isBrowser = accept.includes("text/html");
  if (isBrowser) {
    const next = "/admin/staff";
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(next)}`, req.url));
  }
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  const u = new URL(req.url);
  const limit = Math.max(10, Math.min(500, Number(u.searchParams.get("limit") || "200") || 200));

  const staff = await listStaff({ limit });
  return NextResponse.json({ ok: true, staff });
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const fullName = String(form.get("full_name") || "").trim() || null;
  const role = String(form.get("role") || "staff").trim() as any;
  const password = String(form.get("password") || "").trim() || null;
  const isActive = String(form.get("is_active") || "") === "on";

  await upsertStaff({ email, fullName, role, password, isActive });

  return NextResponse.redirect(new URL("/admin/staff?saved=1", req.url));
}
