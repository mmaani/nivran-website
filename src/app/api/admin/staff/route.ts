import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { listStaff, upsertStaff } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "admin" | "ops" | "staff";

function isHtmlRequest(req: Request): boolean {
  return (req.headers.get("accept") || "").includes("text/html");
}

function unauthorized(req: Request, status: number, error: string) {
  if (isHtmlRequest(req)) {
    const next = "/admin/staff";
    return NextResponse.redirect(new URL(`/admin/login?next=${encodeURIComponent(next)}`, req.url));
  }
  return NextResponse.json({ ok: false, error }, { status });
}

function badRequest(req: Request, error: string) {
  if (isHtmlRequest(req)) {
    return NextResponse.redirect(new URL(`/admin/staff?error=${encodeURIComponent(error)}`, req.url));
  }
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function formText(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseRole(raw: string): Role {
  const v = raw.trim().toLowerCase();
  if (v === "admin") return "admin";
  if (v === "ops") return "ops";
  return "staff";
}

function parseCheckbox(form: FormData, key: string): boolean {
  const v = formText(form, key).toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}

function isValidUsername(u: string): boolean {
  // allow email-ish usernames or simple handles
  return u.length >= 3 && u.length <= 200;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  const u = new URL(req.url);
  const limitRaw = Number(u.searchParams.get("limit") || "200");
  const limit = Math.max(10, Math.min(500, Number.isFinite(limitRaw) ? limitRaw : 200));

  const staff = (await listStaff()).slice(0, limit);
  return NextResponse.json({ ok: true, staff });
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return unauthorized(req, auth.status, auth.error);

  const form = await req.formData();

  // compatible with existing UI field name="email"
  const username = (formText(form, "username") || formText(form, "email")).toLowerCase();
  const full_name = formText(form, "full_name") || null;
  const role = parseRole(formText(form, "role") || "staff");
  const password = formText(form, "password") || undefined;
  const is_active = parseCheckbox(form, "is_active");

  if (!isValidUsername(username)) return badRequest(req, "Invalid username/email.");
  if (!password) return badRequest(req, "Password is required.");

  await upsertStaff({ username, full_name, role, password, is_active });

  if (isHtmlRequest(req)) {
    return NextResponse.redirect(new URL("/admin/staff?saved=1", req.url));
  }
  return NextResponse.json({ ok: true });
}
