import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTablesSafe } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guards";
import { catalogErrorRedirect, catalogSavedRedirect, catalogUnauthorizedRedirect } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let form: FormData | null = null;
  try {
    form = await req.formData();
    const auth = requireAdmin(req);
    if (!auth.ok) {
      const accept = req.headers.get("accept") || "";
      if (accept.includes("text/html")) return catalogUnauthorizedRedirect(req, form);
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    }

    const bootstrap = await ensureCatalogTablesSafe();
    if (!bootstrap.ok) {
      return catalogErrorRedirect(req, form, "settings-store-unavailable");
    }
    const threshold = Number(form.get("free_shipping_threshold_jod") || 0);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return catalogErrorRedirect(req, form, "invalid-free-shipping-threshold");
    }

    await db.query(
      `insert into store_settings (key, value_number, updated_at)
       values ('free_shipping_threshold_jod', $1, now())
       on conflict (key) do update set value_number=excluded.value_number, updated_at=now()`,
      [threshold]
    );

    return catalogSavedRedirect(req, form);
  } catch (error: unknown) {
    console.error("[admin/catalog/settings] route error", error);
    return catalogErrorRedirect(req, form, "settings-save-failed");
  }
}
