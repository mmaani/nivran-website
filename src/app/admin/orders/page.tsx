// src/app/admin/orders/page.tsx
import "server-only";

import { db } from "@/lib/db";
import { ensureOrdersTablesSafe } from "@/lib/orders";
import OrdersClient from "./ui";
import { adminT, getAdminLang } from "@/lib/admin-lang";
import { requireAdmin } from "@/lib/guards";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrdersRow = {
  id: number;
  cart_id: string;
  status: string;
  amount: string;
  currency: string;
  locale: string;
  payment_method: string;
  paytabs_tran_ref: string | null;
  created_at: string;
  customer: unknown;
  shipping: unknown;
  items: unknown;
  subtotal_before_discount_jod: string | null;
  discount_jod: string | null;
  shipping_jod: string | null;
  total_jod: string | null;
  discount_source: string | null;
  promo_code: string | null;
  promotion_id: string | null;
  promo_consumed: boolean | null;
  promo_consume_failed: boolean | null;
  promo_consume_error: string | null;
};

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (key, v) => {
        if (typeof v === "bigint") return v.toString();
        if (typeof v === "function") return `[function ${v.name || "anonymous"}]`;
        if (v instanceof Error) {
          return {
            name: v.name,
            message: v.message,
            stack: v.stack,
            ownKeys: Object.getOwnPropertyNames(v),
          };
        }
        return v;
      },
      2
    );
  } catch {
    try {
      return String(value);
    } catch {
      return "[unstringifiable]";
    }
  }
}

function describeUnknownError(err: unknown): string {
  // 1) Normal Error
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; digest?: unknown; cause?: unknown };
    return safeStringify({
      kind: "Error",
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: anyErr.code,
      digest: anyErr.digest,
      cause: anyErr.cause,
      ownKeys: Object.getOwnPropertyNames(err),
    });
  }

  // 2) ErrorEvent (what you are seeing)
  // In Node/Next this can exist as a global in some paths.
  const isObj = typeof err === "object" && err !== null;

  const anyObj = (isObj ? (err as Record<string, unknown>) : null) as Record<string, unknown> | null;

  const stack =
    isObj && "stack" in (err as object) && typeof (err as { stack?: unknown }).stack === "string"
      ? String((err as { stack?: unknown }).stack)
      : "";

  const message =
    isObj && "message" in (err as object) && typeof (err as { message?: unknown }).message === "string"
      ? String((err as { message?: unknown }).message)
      : "";

  const filename =
    isObj && "filename" in (err as object) && typeof (err as { filename?: unknown }).filename === "string"
      ? String((err as { filename?: unknown }).filename)
      : "";

  const lineno =
    isObj && "lineno" in (err as object) && typeof (err as { lineno?: unknown }).lineno === "number"
      ? (err as { lineno?: number }).lineno
      : null;

  const colno =
    isObj && "colno" in (err as object) && typeof (err as { colno?: unknown }).colno === "number"
      ? (err as { colno?: number }).colno
      : null;

  const innerError = isObj && "error" in (err as object) ? (err as { error?: unknown }).error : null;

  return safeStringify({
    kind: "NonError",
    type: typeof err,
    isObject: isObj,
    constructorName: isObj ? (err as { constructor?: { name?: string } }).constructor?.name : null,
    ownKeys: isObj ? Object.getOwnPropertyNames(err as object) : [],
    // ✅ Key fields that help pinpoint source
    message,
    filename,
    lineno,
    colno,
    stack,
    // ✅ The real error is often inside ErrorEvent.error
    error: innerError instanceof Error
      ? { name: innerError.name, message: innerError.message, stack: innerError.stack }
      : innerError,
    // ✅ Keep the raw value too
    value: anyObj || err,
  });
}


async function cookieHeader(): Promise<string> {
  // Next 15.5+ can return a Promise in some environments; await is safe either way.
  const c = await cookies();
  const parts: string[] = [];
  for (const item of c.getAll()) parts.push(`${item.name}=${item.value}`);
  return parts.join("; ");
}

async function hasColumn(columnName: string): Promise<boolean> {
  const { rows } = await db.query<{ exists: boolean }>(
    `select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'orders'
        and column_name = $1
    ) as exists`,
    [columnName]
  );
  return Boolean(rows[0]?.exists);
}

export default async function AdminOrdersPage() {
  try {
    // ✅ Admin auth (same guard pattern you use elsewhere)
    const req = new Request("http://local.admin/admin/orders", {
      headers: { cookie: await cookieHeader() },
    });

    const auth = requireAdmin(req);
    if (!auth.ok) {
      return (
        <main style={{ padding: 24 }}>
          <h1>Admin — Orders</h1>
          <p>Unauthorized</p>
        </main>
      );
    }

    await ensureOrdersTablesSafe();

    const lang = await getAdminLang();
    const t = adminT(lang);

    const [hasPaymentMethod, hasTranRef, hasItems, hasTotals, hasPromoMeta] = await Promise.all([
      hasColumn("payment_method"),
      hasColumn("paytabs_tran_ref"),
      hasColumn("items"),
      hasColumn("total_jod"),
      hasColumn("discount_source"),
    ]);

    const paymentMethodSelect = hasPaymentMethod ? "payment_method" : "'PAYTABS'::text as payment_method";
    const tranRefSelect = hasTranRef ? "paytabs_tran_ref" : "null::text as paytabs_tran_ref";
    const itemsSelect = hasItems ? "items" : "'[]'::jsonb as items";
    const subtotalSelect = hasTotals
      ? "subtotal_before_discount_jod::text"
      : "null::text as subtotal_before_discount_jod";
    const discountSelect = hasTotals ? "discount_jod::text" : "null::text as discount_jod";
    const shippingSelect = hasTotals ? "shipping_jod::text" : "null::text as shipping_jod";
    const totalSelect = hasTotals ? "total_jod::text" : "null::text as total_jod";

    const discountSourceSelect = hasPromoMeta ? "discount_source::text" : "null::text as discount_source";
    const promoCodeSelect = hasPromoMeta ? "promo_code::text" : "null::text as promo_code";
    const promotionIdSelect = hasPromoMeta ? "promotion_id::text" : "null::text as promotion_id";
    const promoConsumedSelect = hasPromoMeta ? "promo_consumed" : "false as promo_consumed";
    const promoConsumeFailedSelect = hasPromoMeta ? "promo_consume_failed" : "false as promo_consume_failed";
    const promoConsumeErrorSelect = hasPromoMeta ? "promo_consume_error::text" : "null::text as promo_consume_error";

    const { rows } = await db.query<OrdersRow>(
      `select id, cart_id, status, amount, currency, locale,
              ${paymentMethodSelect},
              ${tranRefSelect},
              created_at,
              coalesce(customer, jsonb_build_object('name', customer_name, 'phone', customer_phone, 'email', customer_email)) as customer,
              coalesce(shipping, jsonb_build_object('city', shipping_city, 'address', shipping_address, 'country', shipping_country)) as shipping,
              ${itemsSelect},
              ${subtotalSelect},
              ${discountSelect},
              ${shippingSelect},
              ${totalSelect},
              ${discountSourceSelect},
              ${promoCodeSelect},
              ${promotionIdSelect},
              ${promoConsumedSelect},
              ${promoConsumeFailedSelect},
              ${promoConsumeErrorSelect}
       from orders
       order by created_at desc
       limit 200`
    );

    const hint =
      lang === "ar"
        ? "قواعد الحالة: يجب أن تكون PayTabs «PAID» قبل الشحن؛ والدفع عند الاستلام يستخدم: PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD."
        : "Status guardrails: PayTabs must be PAID before SHIPPING; COD uses PENDING_COD_CONFIRM → PROCESSING → SHIPPED → DELIVERED → PAID_COD.";

    return (
      <div className="admin-grid">
        <div>
          <h1 className="admin-h1">{t("orders")}</h1>
          <p className="admin-muted">{hint}</p>
        </div>

        <OrdersClient initialRows={rows} lang={lang} />
      </div>
    );
  } catch (e: unknown) {
    // ✅ This is the “hard reveal” for the mysterious {} error
    console.error("ADMIN /admin/orders render failed:", e);

    const dump = describeUnknownError(e);

    return (
      <main style={{ padding: 24 }}>
        <h1>Admin — Orders (debug)</h1>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Temporary debug view. Copy the dump below and send it to me.
        </p>
        <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{dump}</pre>
      </main>
    );
  }
}