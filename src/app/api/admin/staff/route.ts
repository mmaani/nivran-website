import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { listStaff, upsertStaff } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Role = "admin" | "ops" | "sales";
type StaffAction = "create" | "update" | "delete" | "reset_password";

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
  if (v === "sales") return "sales";
  return "sales";
}

function parseCheckbox(form: FormData, key: string): boolean {
  const v = formText(form, key).toLowerCase();
  return v === "on" || v === "true" || v === "1" || v === "yes";
}

function isValidUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 200;
}

function parseStaffAction(value: string): StaffAction {
  const v = value.trim().toLowerCase();
  if (v === "update") return "update";
  if (v === "delete") return "delete";
  if (v === "reset_password") return "reset_password";
  return "create";
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

async function deleteStaffUser(staffId: number): Promise<void> {
  await db.query(`delete from staff_users where id=$1`, [staffId]);
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
  const action = parseStaffAction(formText(form, "action") || "create");

  const username = (formText(form, "username") || formText(form, "email")).toLowerCase();
  const full_name = formText(form, "full_name") || null;
  const role = parseRole(formText(form, "role") || "sales");
  const password = formText(form, "password") || undefined;
  const is_active = parseCheckbox(form, "is_active");
  const staffId = parseId(formText(form, "id"));

  try {
    if (action === "delete") {
      if (!staffId) return badRequest(req, "Missing staff id.");
      await deleteStaffUser(staffId);
      if (isHtmlRequest(req)) return NextResponse.redirect(new URL("/admin/staff?saved=deleted", req.url));
      return NextResponse.json({ ok: true, action: "delete" });
    }

    if (action === "reset_password") {
      if (!staffId) return badRequest(req, "Missing staff id.");
      if (!password || password.length < 8) return badRequest(req, "Password must be at least 8 characters.");

      await upsertStaff({ id: staffId, username, full_name, role, password, is_active });
      if (isHtmlRequest(req)) return NextResponse.redirect(new URL("/admin/staff?saved=password", req.url));
      return NextResponse.json({ ok: true, action: "reset_password" });
    }

    if (!isValidUsername(username)) return badRequest(req, "Invalid username/email.");

    if (action === "create" && !password) {
      return badRequest(req, "Password is required.");
    }

    if (action === "update") {
      if (!staffId) return badRequest(req, "Missing staff id.");
      await upsertStaff({ id: staffId, username, full_name, role, password, is_active });
      if (isHtmlRequest(req)) return NextResponse.redirect(new URL("/admin/staff?saved=updated", req.url));
      return NextResponse.json({ ok: true, action: "update" });
    }

    await upsertStaff({ username, full_name, role, password, is_active });
    if (isHtmlRequest(req)) return NextResponse.redirect(new URL("/admin/staff?saved=created", req.url));
    return NextResponse.json({ ok: true, action: "create" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save staff user.";
    if (isHtmlRequest(req)) {
      return NextResponse.redirect(new URL(`/admin/staff?error=${encodeURIComponent(message)}`, req.url));
    }
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
