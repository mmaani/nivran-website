"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

export const dynamic = "force-dynamic";

type OrderItemRow = {
  id: number;
  order_id: number;
  variant_id: number;
  qty: number;
  unit_price_jod: string;
  line_total_jod: string;
  lot_code: string | null;
};

type OrderRow = {
  id: number;
  cart_id: string | null;
  status: string;
  created_at: string;

  amount_jod: string;
  subtotal_before_discount_jod?: string | null;
  discount_jod?: string | null;
  subtotal_after_discount_jod?: string | null;
  shipping_jod?: string | null;
  total_jod?: string | null;

  promo_code?: string | null;
  promotion_id?: string | null;
  discount_source?: string | null;

  items?: unknown[];
  line_items?: OrderItemRow[];
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function OrderDetailsPage() {
  const params = useParams<{ locale?: string; id?: string }>();
  const locale = params?.locale ?? "en";
  const idRaw = params?.id ?? "";

  const id = useMemo(() => {
    const n = Number(idRaw);
    return Number.isFinite(n) && n > 0 ? String(n) : "";
  }, [idRaw]);

  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      setOrder(null);

      if (!id) {
        setErr(isAr ? "معرّف الطلب غير صالح" : "Invalid order id");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/orders?id=${encodeURIComponent(id)}&includeItems=1`, { cache: "no-store" });
      const data = await readJsonSafe(res);

      if (cancelled) return;

      if (!res.ok || !isObject(data) || data.ok !== true || !isObject(data.order)) {
        const msg =
          isObject(data) && typeof data.error === "string"
            ? data.error
            : res.status === 401
              ? "UNAUTHORIZED"
              : "UNKNOWN";
        setErr(msg);
        setLoading(false);
        return;
      }

      setOrder(data.order as unknown as OrderRow);
      setLoading(false);
    }

    run().catch(() => {
      if (!cancelled) {
        setErr(isAr ? "تعذر تحميل الطلب" : "Unable to load order");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, isAr]);

  const header = isAr ? "تفاصيل الطلب" : "Order Details";
  const backToAccount = isAr ? "العودة إلى الحساب" : "Back to account";
  const home = isAr ? "الصفحة الرئيسية" : "Home";

  const statusLabel = isAr ? "الحالة" : "Status";
  const createdLabel = isAr ? "تاريخ الإنشاء" : "Created";
  const amountLabel = isAr ? "المبلغ" : "Amount";
  const subtotalBeforeLabel = isAr ? "الإجمالي قبل الخصم" : "Subtotal before discount";
  const discountLabel = isAr ? "الخصم" : "Discount";
  const subtotalAfterLabel = isAr ? "الإجمالي بعد الخصم" : "Subtotal after discount";
  const shippingLabel = isAr ? "الشحن" : "Shipping";
  const totalLabel = isAr ? "الإجمالي النهائي" : "Total";

  const promoLabel = isAr ? "كود الخصم" : "Promo code";
  const promoSourceLabel = isAr ? "مصدر الخصم" : "Discount source";

  const itemsTitle = isAr ? "المنتجات" : "Items";
  const variantLabel = isAr ? "المتغير" : "Variant";
  const qtyLabel = isAr ? "الكمية" : "Qty";
  const unitLabel = isAr ? "سعر الوحدة" : "Unit price";
  const lineTotalLabel = isAr ? "الإجمالي" : "Line total";
  const lotLabel = isAr ? "رقم التشغيلة" : "Lot";

  return (
    <div dir={dir} style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h1 className="title" style={{ marginTop: 0, marginBottom: 0 }}>
            {header}
          </h1>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="btn btn-outline" href={`/${locale}/account`}>
              {backToAccount}
            </a>
            <a className="btn" href={`/${locale}/`}>
              {home}
            </a>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 6 }}>
          {isAr ? `رقم الطلب: ${idRaw}` : `Order ID: ${idRaw}`}
        </p>

        {loading ? <p className="muted">{isAr ? "جارٍ التحميل..." : "Loading..."}</p> : null}

        {!loading && err ? (
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
            {isAr ? "تعذر عرض الطلب." : "Could not display this order."}{" "}
            <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{err}</span>
          </p>
        ) : null}

        {!loading && !err && order ? (
          <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
            <div className="panel" style={{ padding: 14 }}>
              <div className="grid-2" style={{ gap: 10 }}>
                <div>
                  <div className="muted">{statusLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.status}</div>
                </div>

                <div>
                  <div className="muted">{createdLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.created_at}</div>
                </div>

                <div>
                  <div className="muted">{amountLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.amount_jod} JOD</div>
                </div>

                <div>
                  <div className="muted">{totalLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.total_jod ?? order.amount_jod} JOD</div>
                </div>

                <div>
                  <div className="muted">{subtotalBeforeLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>
                    {order.subtotal_before_discount_jod ?? "—"}
                    {order.subtotal_before_discount_jod ? " JOD" : ""}
                  </div>
                </div>

                <div>
                  <div className="muted">{discountLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>
                    {order.discount_jod ?? "—"}
                    {order.discount_jod ? " JOD" : ""}
                  </div>
                </div>

                <div>
                  <div className="muted">{subtotalAfterLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>
                    {order.subtotal_after_discount_jod ?? "—"}
                    {order.subtotal_after_discount_jod ? " JOD" : ""}
                  </div>
                </div>

                <div>
                  <div className="muted">{shippingLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>
                    {order.shipping_jod ?? "—"}
                    {order.shipping_jod ? " JOD" : ""}
                  </div>
                </div>

                <div>
                  <div className="muted">{promoLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.promo_code ?? "—"}</div>
                </div>

                <div>
                  <div className="muted">{promoSourceLabel}</div>
                  <div style={{ marginTop: 4, fontWeight: 700 }}>{order.discount_source ?? "—"}</div>
                </div>
              </div>
            </div>

            {Array.isArray(order.line_items) && order.line_items.length ? (
              <div className="panel" style={{ padding: 14 }}>
                <h3 style={{ marginTop: 0 }}>{itemsTitle}</h3>

                <div style={{ overflowX: "auto" }}>
                  <table className="table" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>{variantLabel}</th>
                        <th>{qtyLabel}</th>
                        <th>{unitLabel}</th>
                        <th>{lineTotalLabel}</th>
                        <th>{lotLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.line_items.map((li) => (
                        <tr key={li.id}>
                          <td>{li.variant_id}</td>
                          <td>{li.qty}</td>
                          <td>{li.unit_price_jod} JOD</td>
                          <td>{li.line_total_jod} JOD</td>
                          <td>{li.lot_code ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
