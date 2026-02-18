"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { clearLocalCart, readLocalCart, type CartItem } from "@/lib/cartStore";

type Locale = "en" | "ar";
type JsonObject = Record<string, unknown>;
type DiscountMode = "NONE" | "CODE";
type HealthMode = "checking" | "db" | "fallback" | "error";

type PromoState = {
  mode: Exclude<DiscountMode, "NONE">; // "CODE" | "AUTO"
  code: string | null;
  title: string;
  discountJod: number;
};

const PROMO_CODE_STORAGE_KEY = "nivran.checkout.promoCode";

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getStr(obj: JsonRecord, key: string): string | undefined {
  const v = obj[key];
  return typeof v === "string" ? v : undefined;
}

function getNum(obj: JsonRecord, key: string): number | undefined {
  const v = obj[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Error";
}

function clearCart() {
  clearLocalCart();
}

type HealthMode = "checking" | "db" | "fallback" | "error";

export default function CheckoutClient() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const sp = useSearchParams();
  const buyNowSlug = String(sp.get("slug") || "").trim();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("NONE");
  const [selectedPromo, setSelectedPromo] = useState<PromoState | null>(null);
  const [autoPromoCandidate, setAutoPromoCandidate] = useState<PromoState | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [freeShippingThresholdJod, setFreeShippingThresholdJod] = useState(35);
  const [baseShippingJod, setBaseShippingJod] = useState(3.5);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [healthMode, setHealthMode] = useState<HealthMode>("checking");

  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const COPY = useMemo(
    () => ({
      title: isAr ? "الدفع" : "Checkout",
      subtitle: isAr
        ? "أكمل البيانات لتأكيد طلبك والدفع بأمان."
        : "Complete your details to place your order securely.",
      empty: isAr ? "لا توجد عناصر في السلة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      editCart: isAr ? "تعديل السلة" : "Edit cart",
      loadingProduct: isAr ? "جارٍ تحميل المنتج..." : "Loading product...",
      required: isAr
        ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة"
        : "Name, phone, address, and email are required",
      payCard: isAr ? "الدفع بالبطاقة" : "Pay by card",
      cod: isAr ? "الدفع عند الاستلام" : "Cash on delivery",
      orderSummary: isAr ? "ملخص الطلب" : "Order summary",
      originalSubtotal: isAr ? "المجموع قبل الخصم" : "Original subtotal",
      discount: isAr ? "الخصم" : "Discount",
      shipping: isAr ? "الشحن" : "Shipping",
      shippingFree: isAr ? "شحن مجاني" : "Free shipping",
      total: isAr ? "الإجمالي" : "Total",

      fullName: isAr ? "الاسم الكامل" : "Full name",
      phone: isAr ? "رقم الهاتف" : "Phone",
      email: isAr ? "البريد الإلكتروني" : "Email",
      city: isAr ? "المدينة" : "City",
      address: isAr ? "العنوان" : "Address",
      notes: isAr ? "ملاحظات" : "Notes",
      placed: isAr ? "تم إنشاء الطلب." : "Order created.",
      promoLabel: isAr ? "كود الحملة" : "Campaign code",
      havePromo: isAr ? "استخدام كود حملة" : "Use campaign code",
      promoPlaceholder: isAr ? "أدخل الكود" : "Enter code",
      promoApply: isAr ? "تطبيق" : "Apply",
      promoRemove: isAr ? "إزالة" : "Remove",
      promoApplied: isAr ? "تم تطبيق الكود بنجاح" : "Campaign code applied successfully",
      promoExpired: isAr ? "هذا الكود منتهي أو غير نشط" : "This code is expired or inactive",
      promoNotFound: isAr ? "الكود غير موجود" : "Code was not found",
      promoMinOrder: isAr ? "الحد الأدنى للطلب غير مستوفى" : "Minimum order requirement not met",
      promoCoverage: isAr ? "الكود لا ينطبق على هذه المنتجات" : "Code does not apply to current items",
      freeShippingReached: isAr ? "تهانينا! أنت مؤهل للشحن المجاني." : "Great news! You unlocked free shipping.",
      freeShippingRemaining: isAr ? "أضف {{amount}} JOD لتحصل على شحن مجاني" : "Add {{amount}} JOD to unlock free shipping",
      freeShippingThreshold: isAr ? "الحد الحالي للشحن المجاني: {{amount}} JOD" : "Current free-shipping threshold: {{amount}} JOD",
      systemFallback: isAr ? "وضع الطوارئ: عرض البيانات عبر مصدر بديل" : "Fallback mode: degraded data source active",
      systemHealthy: isAr ? "اتصال قاعدة البيانات سليم" : "Database connectivity healthy",
    }),
    [isAr]
  );

  const mapPromoError = useCallback((reason: string, fallbackMessage: string) => {
    if (reason === "PROMO_NOT_FOUND") return COPY.promoNotFound;
    if (reason === "PROMO_MIN_ORDER") return COPY.promoMinOrder;
    if (reason === "PROMO_CATEGORY_MISMATCH") return COPY.promoCoverage;
    if (reason === "PROMO_EXPIRED" || reason === "PROMO_INACTIVE") return COPY.promoExpired;
    if (reason === "DB_CONNECTIVITY") return isAr ? "الخدمة غير متاحة مؤقتًا. حاول لاحقًا." : "Service is temporarily unavailable. Please retry.";
    return fallbackMessage;
  }, [COPY, isAr]);

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(PROMO_CODE_STORAGE_KEY);
      if (remembered) setPromoInput(remembered);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/health", { cache: "no-store" })
      .then(async (res) => {
        const data: unknown = await res.json().catch(() => null);
        if (cancelled) return;

        if (!res.ok || !isObject(data)) {
          setHealthMode("error");
          return;
        }

        const mode = toStr(data.mode).toLowerCase();
        if (mode === "db") setHealthMode("db");
        else if (mode === "fallback") setHealthMode("fallback");
        else setHealthMode("error");
      })
      .catch(() => {
        if (!cancelled) setHealthMode("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cart = readLocalCart();
    if (cart.length) {
      setItems(cart);
      return;
    }

    if (!buyNowSlug) {
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoadingBuyNow(true);

    fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`)
      .then(async (r) => {
        const j: unknown = await r.json().catch(() => null);
        if (cancelled) return;
        if (!isRecord(j) || j.ok !== true) return;

        const product = j.product;
        if (!isRecord(product)) return;

        const slug = (getStr(product, "slug") || "").trim();
        if (!slug) return;

        const nameAr = getStr(product, "name_ar");
        const nameEn = getStr(product, "name_en");
        const prodName = isAr ? (nameAr || nameEn || slug) : (nameEn || nameAr || slug);

        const price = getNum(product, "price_jod") ?? 0;
        const variantIdRaw = getNum(product, "variant_id");
        const variantId = typeof variantIdRaw === "number" && variantIdRaw > 0 ? variantIdRaw : null;
        const variantLabel = getStr(product, "variant_label") || "";

        setItems([
          {
            slug,
            variantId,
            variantLabel,
            name: prodName,
            priceJod: price,
            qty: 1,
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBuyNow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buyNowSlug, isAr]);

  // Reset promos if cart empty
  useEffect(() => {
    if (!items.length) {
      setDiscountMode("NONE");
      setSelectedPromo(null);
      setPromoMsg(null);
    }
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shipping-config", { cache: "no-store" })
      .then(async (r) => {
        const data: unknown = await r.json().catch(() => null);
        if (cancelled || !isObject(data)) return;

        const threshold = toNum(data.thresholdJod);
        const base = toNum(data.baseShippingJod);

        if (threshold >= 0) setFreeShippingThresholdJod(threshold);
        if (base >= 0) setBaseShippingJod(base);

        const fallback = data.fallback === true;
        if (fallback) setHealthMode("fallback");
        else if (healthMode === "checking") setHealthMode("db");
      })
      .catch(() => {
        if (!cancelled && healthMode === "checking") setHealthMode("error");
      });

    return () => {
      cancelled = true;
    };
  }, [healthMode]);

  const runPromoValidation = useCallback(async (codeRaw: string, opts?: { silent?: boolean }) => {
    const code = codeRaw.trim().toUpperCase();
    if (!code || !items.length) return false;
    const silent = opts?.silent === true;

    if (!silent) {
      setPromoBusy(true);
      setPromoMsg(null);
    }
  }, [items]);

    try {
      const res = await fetch("/api/promotions/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "CODE",
          promoCode: code,
          locale,
          items: items.map((i) => ({ slug: i.slug, qty: i.qty, variantId: i.variantId })),
        }),
      });
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok || !isObject(data)) {
        throw new Error(isAr ? "تعذر التحقق من الكود الآن" : "Unable to validate code right now");
      }

      if (data.ok !== true || !isObject(data.promo)) {
        const reason = toStr(data.reason).trim();
        const fallbackMessage = typeof data.error === "string" ? data.error : isAr ? "كود غير صالح" : "Invalid code";
        const finalMessage = mapPromoError(reason, fallbackMessage);

        setSelectedPromo(null);
        setDiscountMode("NONE");
        if (!silent) setPromoMsg(finalMessage);
        return false;
      }

      setSelectedPromo({
        mode: "CODE",
        code,
        title: isAr ? toStr(data.promo.titleAr || data.promo.titleEn || code) : toStr(data.promo.titleEn || data.promo.titleAr || code),
        discountJod: toNum(data.promo.discountJod),
      });
      setDiscountMode("CODE");
      if (!silent) setPromoMsg(COPY.promoApplied);
      setPromoOpen(false);

      try {
        window.localStorage.setItem(PROMO_CODE_STORAGE_KEY, code);
      } catch {
        // no-op
      }

      return true;
    } catch (error: unknown) {
      if (!silent) setPromoMsg(errMsg(error));
      return false;
    } finally {
      if (!silent) setPromoBusy(false);
    }
  }, [COPY.promoApplied, isAr, items, locale, mapPromoError]);

  useEffect(() => {
    if (!selectedPromo?.code || !items.length) return;
    runPromoValidation(selectedPromo.code, { silent: true }).catch(() => null);
  }, [items, selectedPromo?.code, runPromoValidation]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const discount = selectedPromo ? Number(selectedPromo.discountJod || 0) : 0;
    const subtotalAfterDiscount = Math.max(0, subtotal - discount);
    const shipping = items.length ? (freeShippingThresholdJod > 0 && subtotalAfterDiscount >= freeShippingThresholdJod ? 0 : baseShippingJod) : 0;
    const total = Number((subtotalAfterDiscount + shipping).toFixed(2));
    return { subtotal, discount, subtotalAfterDiscount, shipping, total };
  }, [items, selectedPromo, freeShippingThresholdJod, baseShippingJod]);

  const freeShippingRemaining = Math.max(0, freeShippingThresholdJod - totals.subtotalAfterDiscount);
  const freeShippingProgress = freeShippingThresholdJod > 0
    ? Math.max(0, Math.min(100, (totals.subtotalAfterDiscount / freeShippingThresholdJod) * 100))
    : 100;

  function validate() {
    if (!items.length) {
      setErr(COPY.empty);
      return false;
    }
    if (!name.trim() || !phone.trim() || !address.trim() || !email.includes("@")) {
      setErr(COPY.required);
      return false;
    }
    return true;
  }

  async function applyPromoCode() {
    await runPromoValidation(promoInput);
  }

  function removePromoCode() {
    if (selectedPromo?.mode === "CODE") {
      setSelectedPromo(null);
      setDiscountMode("NONE");
    }
    setPromoInput("");
    setPromoMsg(null);
    setPromoOpen(false);
    try {
      window.localStorage.removeItem(PROMO_CODE_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  async function createOrder(paymentMethod: "PAYTABS" | "COD") {
    const payload = {
      locale,
      paymentMethod,
      discountMode,
      promoCode: discountMode === "CODE" ? selectedPromo?.code || undefined : undefined,
      items: items.map((i) => ({ slug: i.slug, qty: i.qty, variantId: i.variantId })),
      customer: { name, phone, email },
      shipping: { city, address, country: "Jordan", notes },
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    let data: unknown = null;

    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        throw new Error(`Order create failed (${res.status})`);
      }
    }

    if (!res.ok || !isRecord(data) || data.ok !== true) {
      const msg = isRecord(data) && typeof data.error === "string" ? data.error : "";
      throw new Error(msg || `Order create failed (${res.status})`);
    }

    const cid = (getStr(data, "cartId") || "").trim();
    const st = (getStr(data, "status") || "").trim();

    setCartId(cid || null);
    setStatus(st || null);

    return cid;
  }

  async function payByCard() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      const cid = await createOrder("PAYTABS");

      const res = await fetch("/api/paytabs/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cartId: cid, locale }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok || !isRecord(data) || data.ok !== true) {
        const msg = isRecord(data) && typeof data.error === "string" ? data.error : "";
        throw new Error(msg || "PayTabs initiate failed");
      }

      const redirectUrl =
        (isObject(data) && typeof data.redirectUrl === "string" && data.redirectUrl)
        || (isObject(data) && typeof data.redirect_url === "string" && data.redirect_url)
        || "";

      if (!redirectUrl) throw new Error("PayTabs redirect URL missing");

      clearCart();
      window.location.href = redirectUrl;
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  async function cashOnDelivery() {
    if (!validate()) return;
    setLoading(true);
    setErr(null);

    try {
      await createOrder("COD");
      clearCart();
      setErr(COPY.placed);
    } catch (e: unknown) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title" style={{ marginTop: 0 }}>
        {COPY.title}
      </h1>
      <p className="lead" style={{ marginTop: 0 }}>
        {COPY.subtitle}
      </p>

      {loadingBuyNow ? <p className="muted">{COPY.loadingProduct}</p> : null}

      {items.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            {COPY.empty}
          </p>
          <div style={{ marginTop: 12 }}>
            <a className="btn btn-outline" href={`/${locale}/product`}>
              {COPY.backToShop}
            </a>
          </div>
        </div>
      ) : (
        <div className="grid-2 checkout-grid">
          <section className="panel checkout-form-panel" style={{ display: "grid", gap: ".55rem" }}>
            <h3 style={{ margin: "0 0 6px" }}>{isAr ? "بيانات التوصيل" : "Delivery details"}</h3>

            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={COPY.fullName} />
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={COPY.phone} />
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={COPY.email} />
            <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder={COPY.city} />
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={COPY.address} />
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder={COPY.notes} />

            {err && <p style={{ color: err === COPY.placed ? "seagreen" : "crimson", margin: 0 }}>{err}</p>}

            <div className="cta-row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={payByCard} disabled={loading}>
                {COPY.payCard}
              </button>
              <button className="btn" onClick={cashOnDelivery} disabled={loading}>
                {COPY.cod}
              </button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <a className="btn btn-outline" href={`/${locale}/cart`}>
                {COPY.editCart}
              </a>
              <a className="btn btn-outline" href={`/${locale}/product`}>
                {COPY.backToShop}
              </a>
            </div>
          </section>

          <aside className="panel checkout-summary-panel">
            <h3 style={{ marginTop: 0 }}>{COPY.orderSummary}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {healthMode === "fallback" ? COPY.systemFallback : healthMode === "db" ? COPY.systemHealthy : null}
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={`${i.slug}::${i.variantId ?? "base"}`} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {i.qty} × {Number(i.priceJod || 0).toFixed(2)} JOD
                    </div>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {i.variantLabel ? `${i.slug} · ${i.variantLabel}` : i.slug}
                    </div>
                  </div>
                  <div style={{ minWidth: 120, textAlign: "end" }}>
                    <strong>{(Number(i.priceJod || 0) * Number(i.qty || 1)).toFixed(2)} JOD</strong>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => { setPromoOpen((v) => !v); setPromoMsg(null); }}>
                {COPY.havePromo}
              </button>

              {totals.subtotalAfterDiscount > 0 ? (
                <>
                  <div
                    aria-hidden
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "#ececec",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${freeShippingProgress.toFixed(1)}%`,
                        height: "100%",
                        background: "linear-gradient(90deg,#141414,#3a3228)",
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>
                  <p className="muted" style={{ margin: 0 }}>{COPY.freeShippingThreshold.replace("{{amount}}", freeShippingThresholdJod.toFixed(2))}</p>
                  {freeShippingRemaining <= 0 ? (
                    <p className="muted" style={{ margin: 0 }}><strong>{COPY.freeShippingReached}</strong></p>
                  ) : (
                    <p className="muted" style={{ margin: 0 }}>{COPY.freeShippingRemaining.replace("{{amount}}", freeShippingRemaining.toFixed(2))}</p>
                  )}
                </>
              ) : null}

              {promoOpen ? (
                <>
                  <label htmlFor="promo-code" className="muted" style={{ fontSize: 13 }}>{COPY.promoLabel}</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      id="promo-code"
                      className="input"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder={COPY.promoPlaceholder}
                      disabled={promoBusy}
                    />
                    <button className="btn btn-outline" type="button" disabled={promoBusy || !promoInput.trim()} onClick={applyPromoCode}>
                      {COPY.promoApply}
                    </button>
                    {selectedPromo?.mode === "CODE" ? (
                      <button className="btn" type="button" onClick={removePromoCode}>
                        {COPY.promoRemove}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}

              {shouldShowPromoMsg ? <p className="muted" style={{ margin: 0 }}>{promoMsg}</p> : null}

              {selectedPromo ? (
                <p className="muted" style={{ margin: 0 }}>
                  <strong>{selectedPromo.mode}</strong> · {selectedPromo.title}
                </p>
              ) : null}
            </div>

            <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid #eee" }} />

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{COPY.originalSubtotal}</span>
                <strong>{totals.subtotal.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{COPY.discount}</span>
                <strong>-{totals.discount.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{COPY.shipping}</span>
                <strong>{totals.shipping <= 0 ? COPY.shippingFree : `${totals.shipping.toFixed(2)} JOD`}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
                <span>{COPY.total}</span>
                <strong>{totals.total.toFixed(2)} JOD</strong>
              </div>
            </div>

            {cartId ? (
              <p style={{ marginBottom: 0, fontFamily: "monospace", marginTop: 12 }}>
                cart_id: {cartId} {status ? `(${status})` : null}
              </p>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
