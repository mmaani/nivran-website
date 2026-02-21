"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { clearLocalCart, readLocalCart, type CartItem } from "@/lib/cartStore";

type Locale = "en" | "ar";

type JsonObject = Record<string, unknown>;

type DiscountMode = "AUTO" | "CODE" | "NONE";

type HealthMode = "checking" | "db" | "fallback" | "error";

type CodePromoState = {
  mode: "CODE";
  code: string;
  title: string;
  discountJod: number;
};

type QuoteLine = {
  slug: string;
  qty: number;
  requestedVariantId: number | null;
  unitPriceJod: number;
  lineTotalJod: number;
  variantLabel: string | null;
  nameEn: string;
  nameAr: string;
};

type QuotePayload = {
  lines: QuoteLine[];
  totals: {
    subtotalBeforeDiscountJod: number;
    discountJod: number;
    subtotalAfterDiscountJod: number;
    shippingJod: number;
    totalJod: number;
    freeShippingThresholdJod: number;
  };
  discount: {
    source: "AUTO" | "CODE" | null;
    code: string | null;
    promotionId: number | null;
    titleEn?: string | null;
    titleAr?: string | null;
  };
};

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

async function readJsonSafe(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function clearCart() {
  clearLocalCart();
}

const PROMO_CODE_STORAGE_KEY = "nivran.checkout.promoCode";

function buildKey(slug: string, requestedVariantId: number | null | undefined): string {
  return `${slug}::${requestedVariantId ?? 0}`;
}

export default function CheckoutClient() {
  const p = useParams<{ locale?: string }>();
  const locale: Locale = p?.locale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const sp = useSearchParams();
  const buyNowSlug = String(sp.get("slug") || "").trim();

  const [items, setItems] = useState<CartItem[]>([]);
  const [loadingBuyNow, setLoadingBuyNow] = useState(false);
  const [buyNowError, setBuyNowError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [promoInput, setPromoInput] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [discountMode, setDiscountMode] = useState<DiscountMode>("AUTO");
  const [selectedCodePromo, setSelectedCodePromo] = useState<CodePromoState | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);

  const [healthMode, setHealthMode] = useState<HealthMode>("checking");

  const [quote, setQuote] = useState<QuotePayload | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);

  const [cartId, setCartId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const promoServiceUnavailable = healthMode === "fallback" || healthMode === "error";

  const COPY = useMemo(
    () => ({
      title: isAr ? "الدفع" : "Checkout",
      subtitle: isAr ? "أكمل البيانات لتأكيد طلبك والدفع بأمان." : "Complete your details to place your order securely.",
      empty: isAr ? "لا توجد عناصر في السلة." : "Your cart is empty.",
      backToShop: isAr ? "العودة للمتجر" : "Back to shop",
      editCart: isAr ? "تعديل السلة" : "Edit cart",
      loadingProduct: isAr ? "جارٍ تحميل المنتج..." : "Loading product...",
      unavailableProduct: isAr ? "هذا المنتج غير متاح حالياً." : "This product is currently unavailable.",
      required: isAr ? "الاسم والهاتف والعنوان والبريد الإلكتروني مطلوبة" : "Name, phone, address, and email are required",
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
      systemFallback: isAr ? "خدمة العروض غير متاحة مؤقتاً. يمكنك المتابعة بدون خصم حالياً." : "Promotions are temporarily unavailable. You can still checkout without a discount.",
      seasonalApplied: isAr ? "خصم موسمي مطبق تلقائياً" : "Seasonal discount applied automatically",
    }),
    [isAr]
  );

  const mapPromoError = useCallback(
    (reason: string, fallbackMessage: string) => {
      if (reason === "PROMO_NOT_FOUND") return COPY.promoNotFound;
      if (reason === "PROMO_MIN_ORDER") return COPY.promoMinOrder;
      if (reason === "PROMO_CATEGORY_MISMATCH") return COPY.promoCoverage;
      if (reason === "PROMO_EXPIRED" || reason === "PROMO_INACTIVE") return COPY.promoExpired;
      if (reason === "CATALOG_BOOTSTRAP_UNAVAILABLE" || reason === "DB_CONNECTIVITY")
        return isAr ? "الخدمة غير متاحة مؤقتًا. حاول لاحقًا." : "Service is temporarily unavailable. Please retry.";
      if (reason === "DISCOUNT_MODE_UNSUPPORTED") return isAr ? "طريقة الخصم غير مدعومة حالياً." : "Discount mode is currently unsupported.";
      return fallbackMessage;
    },
    [COPY, isAr]
  );

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(PROMO_CODE_STORAGE_KEY);
      if (remembered) setPromoInput(remembered);
    } catch {
      // no-op
    }
  }, []);

  // Health mode (DB vs fallback)
  useEffect(() => {
    let cancelled = false;

    fetch("/api/health", { cache: "no-store" })
      .then(async (res) => {
        const data: unknown = await readJsonSafe(res);
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

  // Load cart (or buy-now)
  useEffect(() => {
    const cart = readLocalCart();
    if (cart.length) {
      setBuyNowError(null);
      setItems(cart);
      return;
    }

    if (!buyNowSlug) {
      setBuyNowError(null);
      setItems([]);
      return;
    }

    let cancelled = false;
    setLoadingBuyNow(true);

    fetch(`/api/catalog/product-by-slug?slug=${encodeURIComponent(buyNowSlug)}`, { cache: "no-store" })
      .then(async (r) => {
        const j: unknown = await readJsonSafe(r);
        if (cancelled) return;

        if (!r.ok || !isObject(j) || j.ok !== true || !isObject(j.product)) {
          setItems([]);
          setBuyNowError(COPY.unavailableProduct);
          return;
        }

        const prod = j.product;
        const slug = toStr(prod.slug).trim();
        if (!slug) {
          setItems([]);
          setBuyNowError(COPY.unavailableProduct);
          return;
        }

        const prodName = isAr ? toStr(prod.name_ar || prod.name_en || slug) : toStr(prod.name_en || prod.name_ar || slug);
        const price = toNum(prod.price_jod);

        setBuyNowError(null);
        setItems([
          {
            slug,
            variantId: toNum(prod.variant_id) || null,
            variantLabel: toStr(prod.variant_label),
            name: prodName,
            priceJod: price,
            qty: 1,
          },
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setBuyNowError(COPY.unavailableProduct);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBuyNow(false);
      });

    return () => {
      cancelled = true;
    };
  }, [COPY.unavailableProduct, buyNowSlug, isAr]);

  // Quote helper
  const requestQuote = useCallback(
    async (mode: DiscountMode, code?: string, opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;

      if (!items.length) {
        setQuote(null);
        return { ok: true, reason: "EMPTY", quote: null as QuotePayload | null };
      }

      if (promoServiceUnavailable && mode !== "NONE") {
        mode = "NONE";
      }

      if (!silent) setQuoteBusy(true);
      let parsedQuote: QuotePayload | null = null;

      try {
        const res = await fetch("/api/pricing/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            locale,
            discountMode: mode,
            promoCode: mode === "CODE" ? String(code || "").trim().toUpperCase() : "",
            items: items.map((i) => ({ slug: i.slug, qty: i.qty, variantId: i.variantId })),
          }),
        });

        const data: unknown = await readJsonSafe(res);
        if (!isRecord(data)) {
          if (!silent) setQuote(null);
          return { ok: false, reason: "BAD_RESPONSE", quote: null as QuotePayload | null };
        }

        const hasQuote = isRecord(data.quote);
        if (hasQuote) {
          const q = data.quote as Record<string, unknown>;
          const linesRaw = Array.isArray(q.lines) ? q.lines : [];
          const totalsRaw = isRecord(q.totals) ? (q.totals as Record<string, unknown>) : {};
          const discountRaw = isRecord(q.discount) ? (q.discount as Record<string, unknown>) : {};

          const lines: QuoteLine[] = linesRaw
            .map((l: unknown) => {
              if (!isRecord(l)) return null;
              const slug = String(l.slug || "").trim();
              if (!slug) return null;
              const requestedVariantIdNum = toNum(l.requestedVariantId);
              const requestedVariantId = requestedVariantIdNum > 0 ? Math.trunc(requestedVariantIdNum) : null;
              return {
                slug,
                qty: Math.max(1, Math.min(99, Math.trunc(toNum(l.qty) || 1))),
                requestedVariantId,
                unitPriceJod: toNum(l.unitPriceJod),
                lineTotalJod: toNum(l.lineTotalJod),
                variantLabel: typeof l.variantLabel === "string" ? l.variantLabel : null,
                nameEn: typeof l.nameEn === "string" ? l.nameEn : slug,
                nameAr: typeof l.nameAr === "string" ? l.nameAr : slug,
              };
            })
            .filter((x): x is QuoteLine => !!x);

          const totals = {
            subtotalBeforeDiscountJod: toNum(totalsRaw.subtotalBeforeDiscountJod),
            discountJod: toNum(totalsRaw.discountJod),
            subtotalAfterDiscountJod: toNum(totalsRaw.subtotalAfterDiscountJod),
            shippingJod: toNum(totalsRaw.shippingJod),
            totalJod: toNum(totalsRaw.totalJod),
            freeShippingThresholdJod: toNum(totalsRaw.freeShippingThresholdJod),
          };

          const discount = {
            source: ((): "AUTO" | "CODE" | null => {
              const s = String(discountRaw.source || "").toUpperCase();
              if (s === "AUTO" || s === "CODE") return s;
              return null;
            })(),
            code: typeof discountRaw.code === "string" ? discountRaw.code : null,
            promotionId: ((): number | null => {
              const n = toNum(discountRaw.promotionId);
              return n > 0 ? Math.trunc(n) : null;
            })(),
            titleEn: typeof discountRaw.titleEn === "string" ? discountRaw.titleEn : null,
            titleAr: typeof discountRaw.titleAr === "string" ? discountRaw.titleAr : null,
          };

          parsedQuote = { lines, totals, discount };
          setQuote(parsedQuote);
        } else if (!silent) {
          setQuote(null);
        }

        const ok = data.ok === true;
        const reason = typeof data.reason === "string" ? data.reason : typeof data.reason === "number" ? String(data.reason) : "";

        return { ok, reason, quote: parsedQuote };
      } catch {
        if (!silent) setQuote(null);
        return { ok: false, reason: "NETWORK", quote: null as QuotePayload | null };
      } finally {
        if (!silent) setQuoteBusy(false);
      }
    },
    [items, locale, promoServiceUnavailable]
  );

  // Keep quote fresh
  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      return;
    }

    if (discountMode === "CODE" && selectedCodePromo?.code) {
      requestQuote("CODE", selectedCodePromo.code, { silent: true }).catch(() => null);
      return;
    }

    requestQuote("AUTO", "", { silent: true }).catch(() => null);
  }, [items, discountMode, selectedCodePromo?.code, requestQuote]);

  async function applyPromoCode() {
    if (promoServiceUnavailable) {
      setPromoMsg(COPY.systemFallback);
      return;
    }

    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    setPromoBusy(true);
    setPromoMsg(null);

    try {
      const res = await requestQuote("CODE", code);
      if (!res.ok) {
        const reason = String(res.reason || "").trim();
        const fallbackMessage = isAr ? "كود غير صالح" : "Invalid code";
        setSelectedCodePromo(null);
        setDiscountMode("AUTO");
        setPromoMsg(mapPromoError(reason, fallbackMessage));
        return;
      }

      const q = res.quote;
      const discountSource = q?.discount.source || null;
      const discountJod = q?.totals.discountJod ?? 0;

      if (discountSource !== "CODE" || !(discountJod > 0)) {
        setSelectedCodePromo(null);
        setDiscountMode("AUTO");
        setPromoMsg(isAr ? "الكود غير مؤهل" : "Code is not eligible");
        return;
      }

      const title = isAr
        ? toStr(q?.discount.titleAr || q?.discount.titleEn || code)
        : toStr(q?.discount.titleEn || q?.discount.titleAr || code);

      setSelectedCodePromo({ mode: "CODE", code, title, discountJod });
      setDiscountMode("CODE");
      setPromoMsg(COPY.promoApplied);
      setPromoOpen(false);

      try {
        window.localStorage.setItem(PROMO_CODE_STORAGE_KEY, code);
      } catch {
        // no-op
      }
    } finally {
      setPromoBusy(false);
    }
  }

  function removePromoCode() {
    setSelectedCodePromo(null);
    setDiscountMode("AUTO");
    setPromoInput("");
    setPromoMsg(null);
    setPromoOpen(false);
    try {
      window.localStorage.removeItem(PROMO_CODE_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  const lineMap = useMemo(() => {
    const m = new Map<string, QuoteLine>();
    for (const l of quote?.lines || []) {
      m.set(buildKey(l.slug, l.requestedVariantId), l);
    }
    return m;
  }, [quote?.lines]);

  const totals = useMemo(() => {
    if (quote) {
      return {
        subtotal: quote.totals.subtotalBeforeDiscountJod,
        discount: quote.totals.discountJod,
        subtotalAfterDiscount: quote.totals.subtotalAfterDiscountJod,
        shipping: quote.totals.shippingJod,
        total: quote.totals.totalJod,
        freeShippingThresholdJod: quote.totals.freeShippingThresholdJod,
      };
    }

    const subtotal = items.reduce((sum, i) => sum + Number(i.priceJod || 0) * Number(i.qty || 1), 0);
    const subtotalAfterDiscount = subtotal;
    const shipping = items.length ? 3.5 : 0;
    const total = Number((subtotalAfterDiscount + shipping).toFixed(2));
    return { subtotal, discount: 0, subtotalAfterDiscount, shipping, total, freeShippingThresholdJod: 69 };
  }, [items, quote]);

  const freeShippingRemaining = Math.max(0, totals.freeShippingThresholdJod - totals.subtotalAfterDiscount);
  const freeShippingProgress = totals.freeShippingThresholdJod > 0
    ? Math.max(0, Math.min(100, (totals.subtotalAfterDiscount / totals.freeShippingThresholdJod) * 100))
    : 100;

  const seasonalLabel = useMemo(() => {
    if (!quote) return null;
    if (quote.discount.source !== "AUTO") return null;
    if (!(quote.totals.discountJod > 0)) return null;
    const title = isAr ? quote.discount.titleAr : quote.discount.titleEn;
    return (title && String(title).trim()) || COPY.seasonalApplied;
  }, [quote, isAr, COPY.seasonalApplied]);

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

  async function createOrder(paymentMethod: "PAYTABS" | "COD") {
    const payload = {
      locale,
      paymentMethod,
      discountMode: discountMode === "CODE" ? "CODE" : "NONE",
      promoCode: discountMode === "CODE" ? selectedCodePromo?.code || undefined : undefined,
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

    if (!res.ok || !isObject(data) || data.ok !== true) {
      const msg = isObject(data) && typeof data.error === "string" ? data.error : "";
      throw new Error(msg || `Order create failed (${res.status})`);
    }

    const cid = isObject(data) ? toStr(data.cartId).trim() : "";
    const st = isObject(data) ? toStr(data.status).trim() : "";

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

      const data: unknown = await readJsonSafe(res);
      const ok = isObject(data) && data.ok === true;
      if (!res.ok || !ok) {
        const msg = isObject(data) && typeof data.error === "string" ? data.error : "";
        throw new Error(msg || "PayTabs initiate failed");
      }

      const redirectUrl =
        (isObject(data) && typeof data.redirectUrl === "string" && data.redirectUrl) ||
        (isObject(data) && typeof data.redirect_url === "string" && data.redirect_url) ||
        "";

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
            {buyNowError || COPY.empty}
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
              <button className="btn primary" onClick={payByCard} disabled={loading || quoteBusy}>{COPY.payCard}</button>
              <button className="btn" onClick={cashOnDelivery} disabled={loading || quoteBusy}>{COPY.cod}</button>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <a className="btn btn-outline" href={`/${locale}/cart`}>{COPY.editCart}</a>
              <a className="btn btn-outline" href={`/${locale}/product`}>{COPY.backToShop}</a>
            </div>
          </section>

          <aside className="panel checkout-summary-panel">
            <h3 style={{ marginTop: 0 }}>{COPY.orderSummary}</h3>
            {promoServiceUnavailable ? (
              <p className="muted" style={{ marginTop: 0 }}>{COPY.systemFallback}</p>
            ) : null}

            {seasonalLabel && discountMode !== "CODE" ? (
              <div className="panel" style={{ padding: 12, marginBottom: 12, background: "linear-gradient(130deg,#fff,#fff8ee)", border: "1px solid #f0e1c4" }}>
                <strong>{seasonalLabel}</strong>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => {
                const key = buildKey(i.slug, i.variantId);
                const live = lineMap.get(key);
                const unit = live ? live.unitPriceJod : Number(i.priceJod || 0);
                const lineTotal = live ? live.lineTotalJod : Number((unit * Number(i.qty || 1)).toFixed(2));
                const vLabel = live?.variantLabel || i.variantLabel;
                const displayName = live ? (isAr ? live.nameAr : live.nameEn) : i.name;

                return (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <strong>{displayName}</strong>
                      <div className="muted" style={{ marginTop: 4 }}>{i.qty} × {unit.toFixed(2)} JOD</div>
                      <div className="muted" style={{ marginTop: 2 }}>{vLabel ? `${i.slug} · ${vLabel}` : i.slug}</div>
                    </div>
                    <div style={{ minWidth: 120, textAlign: "end" }}>
                      <strong>{lineTotal.toFixed(2)} JOD</strong>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => { setPromoOpen((v) => !v); setPromoMsg(null); }}>
                {COPY.havePromo}
              </button>

              {totals.subtotalAfterDiscount > 0 ? (
                <>
                  <div aria-hidden style={{ height: 8, borderRadius: 999, background: "#ececec", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${freeShippingProgress.toFixed(1)}%`,
                        height: "100%",
                        background: "linear-gradient(90deg,#141414,#3a3228)",
                        transition: "width 180ms ease",
                      }}
                    />
                  </div>
                  <p className="muted" style={{ margin: 0 }}>{COPY.freeShippingThreshold.replace("{{amount}}", totals.freeShippingThresholdJod.toFixed(2))}</p>
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
                    <button className="btn btn-outline" type="button" disabled={promoBusy || !promoInput.trim() || promoServiceUnavailable} onClick={applyPromoCode}>
                      {COPY.promoApply}
                    </button>
                    {selectedCodePromo ? (
                      <button className="btn" type="button" onClick={removePromoCode}>{COPY.promoRemove}</button>
                    ) : null}
                  </div>
                </>
              ) : null}

              {promoOpen && promoServiceUnavailable && !promoMsg ? (
                <p className="muted" style={{ margin: 0 }}>{COPY.systemFallback}</p>
              ) : null}
              {promoMsg ? <p className="muted" style={{ margin: 0 }}>{promoMsg}</p> : null}

              {selectedCodePromo ? (
                <p className="muted" style={{ margin: 0 }}>
                  <strong>CODE</strong> · {selectedCodePromo.title}
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
