"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type OrderStatusResponse = {
  cart_id?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
};

type OrdersStatusApiResponse = {
  ok?: boolean;
  error?: string;
  order?: OrderStatusResponse;
};

const COPY = {
  en: {
    title: "Order status",
    loading: "Checking payment status…",
    paid: "Payment received. Thank you!",
    pending: "Payment is still pending. If you just paid, refresh in a moment.",
    failed: "Payment failed. You can try again.",
    canceled: "Payment was canceled.",
    backShop: "Back to shop",
    tryAgain: "Try checkout again",
    cart: "Cart ID",
    amount: "Amount",
    status: "Status",
  },
  ar: {
    title: "حالة الطلب",
    loading: "جارٍ التحقق من حالة الدفع…",
    paid: "تم استلام الدفع. شكراً لك!",
    pending: "الدفع ما زال قيد المعالجة. إذا دفعت الآن، أعد المحاولة بعد قليل.",
    failed: "فشل الدفع. يمكنك المحاولة مرة أخرى.",
    canceled: "تم إلغاء الدفع.",
    backShop: "العودة للمتجر",
    tryAgain: "العودة إلى صفحة الدفع",
    cart: "رقم الطلب",
    amount: "المبلغ",
    status: "الحالة",
  },
};

function statusMsg(locale: "en" | "ar", s: string) {
  const t = COPY[locale];
  const u = String(s || "").toUpperCase();
  if (u === "PAID") return t.paid;
  if (u === "FAILED") return t.failed;
  if (u === "CANCELED") return t.canceled;
  return t.pending;
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Failed";
}

export default function CheckoutResultPage() {
  const params = useParams<{ locale: string }>();
  const search = useSearchParams();
  const locale: "en" | "ar" = params?.locale === "ar" ? "ar" : "en";
  const t = COPY[locale];

  const cartId = (search?.get("cartId") || "").trim();

  const [data, setData] = useState<OrderStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (!cartId) return;
      try {
        const r = await fetch(`/api/orders/status?cartId=${encodeURIComponent(cartId)}`, { cache: "no-store" });
        const j = (await r.json().catch(() => ({}))) as OrdersStatusApiResponse;
        if (!r.ok || !j?.ok) throw new Error(j?.error || "Failed");
        if (!stop) setData(j.order || null);
      } catch (e: unknown) {
        if (!stop) setErr(toErrorMessage(e));
      } finally {
        if (!stop) {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    poll();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [cartId]);

  const st = String(data?.status || "");
  const msg = useMemo(() => statusMsg(locale, st), [locale, st]);

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {t.title}
      </h1>

      {!cartId ? (
        <p className="muted">{locale === "ar" ? "رقم الطلب غير موجود." : "Missing cartId."}</p>
      ) : null}

      {err ? <p style={{ color: "#b00" }}>{err}</p> : null}

      {!data && cartId ? <p className="muted">{t.loading}</p> : null}

      {data ? (
        <div className="panel">
          <p style={{ marginTop: 0 }}>{msg}</p>

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.cart}</span>
              <span className="ltr">{data.cart_id || cartId}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.status}</span>
              <span className="ltr">{data.status}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <span>{t.amount}</span>
              <span className="ltr">{Number(data.amount || 0).toFixed(2)} {data.currency || "JOD"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a className="btn" href={`/${locale}/product`}>
              {t.backShop}
            </a>
            <a className="btn btn-outline" href={`/${locale}/checkout?cartId=${encodeURIComponent(cartId)}`}>
              {t.tryAgain}
            </a>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .ltr {
          direction: ltr;
          unicode-bidi: plaintext;
        }
      `}</style>
    </div>
  );
}
