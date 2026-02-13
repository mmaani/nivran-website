import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureIdentityTables, hashPassword } from "@/lib/identity";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureIdentityTables();
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const fullName = String(form.get("full_name") || "").trim() || null;
  const role = String(form.get("role") || "staff").trim() || "staff";
  const password = String(form.get("password") || "");
  const isActive = String(form.get("is_active") || "") === "on";

  if (!email.includes("@") || password.length < 8) {
    return NextResponse.redirect(new URL("/admin/staff?error=invalid", req.url));
  }

  await db.query(
    `insert into staff_users (email, password_hash, full_name, role, is_active)
     values ($1,$2,$3,$4,$5)
     on conflict (email) do update
       set password_hash=excluded.password_hash,
           full_name=excluded.full_name,
           role=excluded.role,
           is_active=excluded.is_active,
           updated_at=now()`,
    [email, hashPassword(password), fullName, role, isActive]
  );

  return NextResponse.redirect(new URL("/admin/staff?saved=1", req.url));
}
