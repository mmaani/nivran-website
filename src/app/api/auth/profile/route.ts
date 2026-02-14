// src/app/api/auth/profile/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCustomerIdFromRequest } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { rows } = await db.query<{ id: number; email: string; full_name: string | null }>(
    `select id, email, full_name
     from customers
     where id=$1
     limit 1`,
    [customerId]
  );

  const me = rows[0];
  if (!me) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, me });
}
