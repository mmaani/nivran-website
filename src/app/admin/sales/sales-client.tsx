"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { readAdminLangCookie } from "@/app/admin/_components/adminClient";

type ProductVariant = {
  id: number;
  label: string;
  size_ml: number | null;
  price_jod: string;
  is_default: boolean;
};

type Product = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price_jod: string;
  inventory_qty: number;
  category_key?: string | null;
  active_promo_count?: number;
  variants: ProductVariant[];
};

type Promo = { id: number; code: string | null; title_en: string | null; title_ar: string | null; discount_type: string; discount_value: string };

type CartLine = { productId: number; variantId: number | null; productSlug: string; qty: number; unitPriceJod: number; variantLabel: string };

type OrderRow = {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total_jod: string;
  status?: string;
  payment_method?: string;
  item_lines?: number;
  item_qty_total?: number;
  created_at: string;
};

type OrdersResponse = {
  orders: OrderRow[];
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
};

type PromoQuoteState = {
  checking: boolean;
  discountJod: number;
  subtotalAfterDiscountJod: number;
  error: string | null;
};

function money(n: number): string {
  return `${n.toFixed(2)} JOD`;
}

function cartKey(productId: number, variantId: number | null): string {
  return `${productId}:${variantId ?? "base"}`;
}

function normalizeId(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

function normalizeVariantId(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function resolveCartLinePricing(product: Product, variantId: number | null, isAr: boolean): { unitPriceJod: number; variantLabel: string } {
  if (variantId) {
    const selectedVariant = product.variants?.find((entry) => normalizeId(entry.id) === variantId) || null;
    if (selectedVariant) {
      const unitPriceJod = Number(selectedVariant.price_jod || product.price_jod || 0);
      const variantLabel = `${selectedVariant.label}${selectedVariant.size_ml ? ` (${selectedVariant.size_ml}ml)` : ""}`;
      return { unitPriceJod, variantLabel };
    }
  }

  const fallbackUnitPrice = Number(product.price_jod || 0);
  return { unitPriceJod: fallbackUnitPrice, variantLabel: isAr ? "أساسي" : "Base" };
}

export default function SalesClient({ initialLang = "en" }: { initialLang?: "en" | "ar" }) {
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [variantSelection, setVariantSelection] = useState<Record<number, number | null>>({});
  const [query, setQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"recent" | "name" | "stock-asc" | "stock-desc">("recent");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<"" | "PAID" | "BACKORDER">("");
  const [ordersLimit, setOrdersLimit] = useState<10 | 20 | 30>(10);
  const [ordersOffset, setOrdersOffset] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersFrom, setOrdersFrom] = useState("");
  const [ordersTo, setOrdersTo] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [applyPromotion, setApplyPromotion] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Amman");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CARD_POS" | "CARD_ONLINE" | "CASH">("CARD_POS");
  const [createAccount, setCreateAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [promoQuote, setPromoQuote] = useState<PromoQuoteState>({ checking: false, discountJod: 0, subtotalAfterDiscountJod: 0, error: null });

  useEffect(() => {
    setLang(readAdminLangCookie());

    function onLangChanged(event: Event) {
      const custom = event as CustomEvent<{ lang?: "en" | "ar" }>;
      const next = custom.detail?.lang;
      if (next === "ar" || next === "en") {
        setLang(next);
        return;
      }
      setLang(readAdminLangCookie());
    }

    window.addEventListener("admin_lang_changed", onLangChanged as EventListener);
    return () => window.removeEventListener("admin_lang_changed", onLangChanged as EventListener);
  }, []);

  const isAr = lang === "ar";

  const load = useCallback(async (offsetOverride?: number, append = false) => {
    const offset = typeof offsetOverride === "number" ? Math.max(0, Math.trunc(offsetOverride)) : ordersOffset;
    if (ordersFrom && ordersTo && ordersFrom > ordersTo) {
      setMsg(isAr ? "تاريخ البداية يجب أن يكون قبل تاريخ النهاية." : "From date must be before To date.");
      return;
    }

    const orderParams = new URLSearchParams({ limit: String(ordersLimit), offset: String(offset) });
    if (ordersStatusFilter) orderParams.set("status", ordersStatusFilter);
    if (ordersFrom) orderParams.set("from", ordersFrom);
    if (ordersTo) orderParams.set("to", ordersTo);

    setOrdersLoading(true);
    try {
      const [catalogRes, ordersRes] = await Promise.all([
        fetch("/api/admin/sales/catalog", { credentials: "include", cache: "no-store" }),
        fetch(`/api/admin/sales/orders?${orderParams.toString()}`, { credentials: "include", cache: "no-store" }),
      ]);
      if (!catalogRes.ok || !ordersRes.ok) {
        throw new Error(isAr ? "تعذر تحميل بيانات المبيعات." : "Could not load sales data.");
      }
      const catalog = (await catalogRes.json()) as { products: Product[]; promotions: Promo[] };
      const salesOrders = (await ordersRes.json()) as OrdersResponse;

      const loadedProducts = (Array.isArray(catalog.products) ? catalog.products : []).map((product) => ({
        ...product,
        id: normalizeId(product.id),
        variants: Array.isArray(product.variants)
          ? product.variants.map((variant) => ({
              ...variant,
              id: normalizeId(variant.id),
            }))
          : [],
      })).filter((product) => product.id > 0);
      setProducts(loadedProducts);
      setPromos(Array.isArray(catalog.promotions) ? catalog.promotions : []);
      const nextOrders = Array.isArray(salesOrders.orders) ? salesOrders.orders : [];
      setOrders((prev) => (append ? [...prev, ...nextOrders] : nextOrders));
      setOrdersHasMore(Boolean(salesOrders.pagination?.hasMore));
      setOrdersOffset(offset);

      const selection: Record<number, number | null> = {};
      for (const product of loadedProducts) {
        const defaultVariant = product.variants?.find((variant) => variant.is_default) || product.variants?.[0] || null;
        selection[product.id] = defaultVariant ? defaultVariant.id : null;
      }
      setVariantSelection(selection);
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : (isAr ? "تعذر تحميل البيانات." : "Failed to load sales data."));
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersLimit, ordersStatusFilter, ordersFrom, ordersTo, ordersOffset, isAr]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOrdersOffset(0);
  }, [ordersLimit, ordersStatusFilter, ordersFrom, ordersTo]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (showLowStockOnly && product.inventory_qty > 5) return false;
      if (!q) return true;
      const hay = `${product.name_en} ${product.name_ar} ${product.slug}`.toLowerCase();
      return hay.includes(q);
    });

    if (sortMode === "name") {
      return [...filtered].sort((a, b) => a.name_en.localeCompare(b.name_en));
    }
    if (sortMode === "stock-asc") {
      return [...filtered].sort((a, b) => a.inventory_qty - b.inventory_qty);
    }
    if (sortMode === "stock-desc") {
      return [...filtered].sort((a, b) => b.inventory_qty - a.inventory_qty);
    }

    return filtered;
  }, [products, query, showLowStockOnly, sortMode]);

  const cartRows = useMemo(
    () =>
      cart
        .map((line) => {
          const product = productById.get(line.productId);
          if (!product) return null;
          const pricing = resolveCartLinePricing(product, line.variantId, isAr);
          const unitPrice = Number(pricing.unitPriceJod || 0);

          return {
            ...line,
            variantLabel: pricing.variantLabel,
            key: cartKey(line.productId, line.variantId),
            product,
            unitPrice,
            lineTotal: unitPrice * line.qty,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [cart, productById, isAr]
  );

  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart]);
  const subtotal = useMemo(() => cartRows.reduce((sum, row) => sum + row.lineTotal, 0), [cartRows]);

  useEffect(() => {
    const normalizedCode = promoCode.trim();
    if (!applyPromotion || !normalizedCode || cartRows.length === 0) {
      setPromoQuote({ checking: false, discountJod: 0, subtotalAfterDiscountJod: subtotal, error: null });
      return;
    }

    const controller = new AbortController();
    setPromoQuote((prev) => ({ ...prev, checking: true, error: null }));

    const run = async () => {
      try {
        const response = await fetch('/api/promotions/validate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          signal: controller.signal,
          body: JSON.stringify({
            mode: 'CODE',
            promoCode: normalizedCode,
            locale: lang,
            items: cartRows.map((row) => ({ slug: row.productSlug, qty: row.qty, variantId: row.variantId })),
          }),
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          promo?: { discountJod?: number; subtotalAfterDiscountJod?: number } | null;
        };

        if (controller.signal.aborted) return;
        if (!payload.ok || !payload.promo) {
          setPromoQuote({
            checking: false,
            discountJod: 0,
            subtotalAfterDiscountJod: subtotal,
            error: payload.error || (isAr ? 'لا يمكن تطبيق العرض على السلة الحالية.' : 'Promotion cannot be applied to this cart.'),
          });
          return;
        }

        const discount = Number(payload.promo.discountJod || 0);
        const afterDiscount = Number(payload.promo.subtotalAfterDiscountJod || subtotal);
        setPromoQuote({ checking: false, discountJod: discount, subtotalAfterDiscountJod: afterDiscount, error: null });
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setPromoQuote({
          checking: false,
          discountJod: 0,
          subtotalAfterDiscountJod: subtotal,
          error: error instanceof Error ? error.message : (isAr ? 'تعذر التحقق من العرض.' : 'Failed to validate promotion.'),
        });
      }
    };

    void run();
    return () => controller.abort();
  }, [applyPromotion, promoCode, cartRows, subtotal, lang, isAr]);

  function updateQty(productIdRaw: number, variantIdRaw: number | null, nextQty: number) {
    const productId = normalizeId(productIdRaw);
    const variantId = normalizeVariantId(variantIdRaw);
    const qty = Math.max(0, Math.trunc(nextQty));
    if (productId <= 0) return;

    setCart((prev) => {
      if (qty <= 0) return prev.filter((line) => !(line.productId === productId && line.variantId === variantId));
      const found = prev.find((line) => line.productId === productId && line.variantId === variantId);
      if (!found) {
        const product = productById.get(productId);
        if (!product) return prev;
        const pricing = resolveCartLinePricing(product, variantId, isAr);
        return [...prev, { productId, variantId, productSlug: product.slug || "", qty, unitPriceJod: pricing.unitPriceJod, variantLabel: pricing.variantLabel }];
      }
      return prev.map((line) => (line.productId === productId && line.variantId === variantId ? { ...line, qty } : line));
    });
  }

  function add(productIdRaw: number) {
    const productId = normalizeId(productIdRaw);
    const product = productById.get(productId);
    if (!product) return;

    const fallbackVariant = product.variants?.find((variant) => variant.is_default)?.id
      ?? product.variants?.[0]?.id
      ?? null;
    const selectedVariant = normalizeVariantId(variantSelection[productId] ?? fallbackVariant);
    const existing = cart.find((line) => line.productId === productId && line.variantId === selectedVariant);
    updateQty(productId, selectedVariant, (existing?.qty || 0) + 1);
  }

  function clearCart() {
    setCart([]);
  }

  function resetOrdersFilters() {
    setOrdersStatusFilter("");
    setOrdersLimit(10);
    setOrdersFrom("");
    setOrdersTo("");
    setOrdersOffset(0);
  }

  const paymentLabel = (value?: string | null) => {
    const normalized = String(value || "").toUpperCase();
    if (normalized === "CARD_POS") return isAr ? "بطاقة نقطة بيع" : "Card POS";
    if (normalized === "CARD_ONLINE") return isAr ? "بطاقة أونلاين" : "Card Online";
    if (normalized === "CASH") return isAr ? "نقدًا" : "Cash";
    return value || "—";
  };

  const statusLabel = (value?: string | null) => {
    const normalized = String(value || "").toUpperCase();
    if (normalized === "PAID") return isAr ? "مدفوع" : "Paid";
    if (normalized === "BACKORDER") return isAr ? "طلب مؤجل" : "Backorder";
    return value || "—";
  };

  const applyPromotionCode = (code: string | null | undefined) => {
    const next = String(code || "").trim();
    if (!next) return;
    setPromoCode(next);
    setApplyPromotion(true);
    setMsg(isAr ? `تم تطبيق رمز العرض: ${next}` : `Promotion code applied: ${next}`);
  };

  const clearPromotionCode = () => {
    setPromoCode("");
    setApplyPromotion(false);
    setMsg(isAr ? "تمت إزالة رمز العرض من الطلب." : "Promotion code removed from checkout.");
  };

  async function checkout() {
    setLoading(true);
    setMsg("");

    if (!name.trim() || !email.trim() || !phone.trim() || !city.trim() || !address.trim()) {
      setMsg(isAr ? "يرجى إكمال بيانات العميل قبل إتمام البيع." : "Please complete customer information before checkout.");
      setLoading(false);
      return;
    }

    if (createAccount && !accountPassword.trim()) {
      setMsg(isAr ? "يرجى إدخال كلمة مرور الحساب عند تفعيل إنشاء الحساب." : "Please enter account password when account creation is enabled.");
      setLoading(false);
      return;
    }

    const staleIds = cart
      .filter((line) => !productById.has(line.productId))
      .map((line) => line.productId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx);
    if (staleIds.length > 0) {
      setCart((prev) => prev.filter((line) => !staleIds.includes(line.productId)));
      setMsg(
        isAr
          ? `تمت إزالة عناصر غير متاحة من السلة: ${staleIds.join(", ")}. يرجى المراجعة ثم التأكيد مرة أخرى.`
          : `Some items were removed because they are no longer available: ${staleIds.join(", ")}. Please review cart and confirm again.`
      );
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/sales/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: cart.map((line) => ({ productId: normalizeId(line.productId), productSlug: line.productSlug, variantId: normalizeVariantId(line.variantId), qty: line.qty })),
          promoCode: applyPromotion ? (promoCode.trim() || undefined) : undefined,
          applyPromotion,
          customer: { name, email, phone, city, address, country: "Jordan" },
          paymentMethod,
          createAccount,
          accountPassword: createAccount ? accountPassword : undefined,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        orderId?: number;
        statusCode?: string;
        error?: string;
        ignoredProductIds?: number[];
        missingProductIds?: number[];
        warning?: string | null;
        customerMatched?: boolean;
        customerCreated?: boolean;
        createdAccountEmail?: string | null;
        staleCart?: boolean;
      };
      if (!res.ok || !data.ok) {
        if (Array.isArray(data.missingProductIds) && data.missingProductIds.length > 0) {
          const missing = data.missingProductIds.filter((id) => Number.isFinite(id) && id > 0);
          if (missing.length > 0) {
            setCart((prev) => prev.filter((line) => !missing.includes(line.productId)));
            await load();
            throw new Error(
              isAr
                ? `بعض المنتجات لم تعد متاحة (${missing.join(", ")}) وتمت إزالتها من السلة. يرجى التأكيد مرة أخرى.`
                : `Some products are no longer available (${missing.join(", ")}). They were removed from your cart. Please confirm again.`
            );
          }
        }
        if (res.status === 409 && data.error) {
          throw new Error(isAr ? "تعذر إتمام البيع لأن المنتجات تغيّرت. تم تحديث السلة، راجعها ثم أكد مجددًا." : data.error);
        }
        throw new Error(data.error || "Checkout failed");
      }

      const ignored = Array.isArray(data.ignoredProductIds) ? data.ignoredProductIds.filter((id) => Number.isFinite(id) && id > 0) : [];
      const ignoredLabel = ignored.length
        ? isAr
          ? ` (تم تجاهل منتجات غير متاحة: ${ignored.join(", ")})`
          : ` (ignored unavailable products: ${ignored.join(", ")})`
        : "";
      const matchedLabel = data.customerMatched
        ? isAr
          ? " (تم تحديث ملف عميل موجود)"
          : " (existing customer profile updated)"
        : "";
      const createdLabel = data.customerCreated
        ? isAr
          ? ` • تم إنشاء حساب جديد${data.createdAccountEmail ? ` (${data.createdAccountEmail})` : ""}`
          : ` • New customer profile created${data.createdAccountEmail ? ` (${data.createdAccountEmail})` : ""}`
        : "";
      const warningLabel = data.warning ? ` • ${data.warning}` : "";
      setMsg(
        isAr
          ? `تمت عملية البيع بنجاح. طلب #${data.orderId || ""}${data.statusCode === "BACKORDER" ? " (تم إنشاء طلب مؤجل)" : ""}${ignoredLabel}${matchedLabel}${createdLabel}${warningLabel}`
          : `Sale completed. Order #${data.orderId || ""}${data.statusCode === "BACKORDER" ? " (Backorder created)" : ""}${ignoredLabel}${matchedLabel}${createdLabel}${warningLabel}`
      );
      setCart([]);
      setPromoCode("");
      setApplyPromotion(false);
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : isAr ? "فشلت عملية الإتمام" : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-grid" style={{ gap: 16 }} dir={isAr ? "rtl" : "ltr"}>
      <h1 className="admin-h1">{isAr ? "بوابة المبيعات" : "Sales Portal"}</h1>

      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div className="admin-card" style={{ padding: 12 }}><b>{isAr ? "المنتجات المعروضة" : "Visible products"}</b><div>{visibleProducts.length}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{isAr ? "العروض" : "Promotions"}</b><div>{promos.length}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{isAr ? "عناصر السلة" : "Cart items"}</b><div>{itemCount}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{isAr ? "المجموع الفرعي" : "Subtotal"}</b><div>{money(subtotal)}</div></div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>{isAr ? "المنتجات" : "Products"}</h3>
        <div className="admin-row" style={{ gap: 8, marginBottom: 10 }}>
          <input className="admin-input" placeholder={isAr ? "ابحث بالمنتج / الرابط" : "Search product / slug"} value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="admin-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
            <option value="recent">{isAr ? "الأحدث تحديثًا" : "Recently updated"}</option>
            <option value="name">{isAr ? "الاسم (أ-ي)" : "Name (A-Z)"}</option>
            <option value="stock-asc">{isAr ? "المخزون (منخفض ← مرتفع)" : "Stock (low → high)"}</option>
            <option value="stock-desc">{isAr ? "المخزون (مرتفع ← منخفض)" : "Stock (high → low)"}</option>
          </select>
          <label className="admin-row" style={{ gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={showLowStockOnly} onChange={(event) => setShowLowStockOnly(event.target.checked)} />
            {isAr ? "المخزون المنخفض فقط (≤5)" : "Low stock only (≤5)"}
          </label>
        </div>
        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto" }}>
          {visibleProducts.length === 0 ? (
            <p className="admin-muted" style={{ margin: 0 }}>{isAr ? "لا توجد منتجات مطابقة للبحث الحالي." : "No products match current filters."}</p>
          ) : null}

          {visibleProducts.map((product) => (
            <div key={product.id} className="admin-row" style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,.08)", paddingBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div><b>{isAr ? product.name_ar || product.name_en : product.name_en}</b> <span style={{ opacity: 0.6 }}>({product.slug})</span></div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {money(Number(product.price_jod))} • {isAr ? "المخزون" : "Stock"} {product.inventory_qty}
                  {product.inventory_qty <= 5 ? <b style={{ marginInlineStart: 8, color: "#8b5e1a" }}>{isAr ? "مخزون منخفض" : "Low stock"}</b> : null}
                  {Number(product.active_promo_count || 0) > 0 ? <b style={{ marginInlineStart: 8, color: "#1f6f43" }}>{isAr ? `ضمن عرض (${product.active_promo_count})` : `On promotion (${product.active_promo_count})`}</b> : null}
                </div>
                {product.variants?.length ? (
                  <select
                    className="admin-select"
                    value={variantSelection[product.id] ?? ""}
                    onChange={(event) => setVariantSelection((prev) => ({ ...prev, [product.id]: normalizeVariantId(event.target.value) }))}
                    style={{ marginTop: 6, maxWidth: 320 }}
                  >
                    <option value="">{isAr ? "المنتج الأساسي" : "Base product"} — {money(Number(product.price_jod))}</option>
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}{variant.size_ml ? ` (${variant.size_ml}ml)` : ""} — {money(Number(variant.price_jod))}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <button className="btn" onClick={() => add(product.id)}>{isAr ? "إضافة" : "Add"}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>{isAr ? "السلة" : "Cart"}</h3>
        {cartRows.length === 0 ? <p className="admin-muted">{isAr ? "لا توجد عناصر في السلة." : "No items in cart."}</p> : null}
        {cartRows.map((row) => (
          <div key={row.key} className="admin-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <b>{isAr ? row.product.name_ar || row.product.name_en : row.product.name_en}</b>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{row.variantLabel || (isAr ? "أساسي" : "Base")}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{money(row.unitPrice)} {isAr ? "لكل قطعة" : "each"}</div>
            </div>
            <div className="admin-row" style={{ gap: 6 }}>
              <button className="btn" onClick={() => updateQty(row.productId, row.variantId, row.qty - 1)}>-</button>
              <input className="admin-input" style={{ width: 64, textAlign: "center" }} value={row.qty} onChange={(event) => updateQty(row.productId, row.variantId, Number(event.target.value || 0))} />
              <button className="btn" onClick={() => updateQty(row.productId, row.variantId, row.qty + 1)}>+</button>
              <button className="btn" onClick={() => updateQty(row.productId, row.variantId, 0)}>{isAr ? "إزالة" : "Remove"}</button>
            </div>
            <div style={{ minWidth: 120, textAlign: "right" }}>{money(row.lineTotal)}</div>
          </div>
        ))}

        {cartRows.length > 0 ? (
          <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <b>{isAr ? "المجموع الفرعي" : "Subtotal"}</b>
            <b>{money(subtotal)}</b>
          </div>
        ) : null}
        <div className="admin-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={clearCart} disabled={cartRows.length === 0}>{isAr ? "تفريغ السلة" : "Clear cart"}</button>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>{isAr ? "إتمام البيع" : "Checkout"}</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <input className="admin-input" placeholder={isAr ? "اسم العميل" : "Customer name"} value={name} onChange={(event) => setName(event.target.value)} />
          <input className="admin-input" placeholder={isAr ? "البريد الإلكتروني" : "Email"} value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="admin-input" placeholder={isAr ? "الهاتف" : "Phone"} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input className="admin-input" placeholder={isAr ? "المدينة" : "City"} value={city} onChange={(event) => setCity(event.target.value)} />
          <input className="admin-input" placeholder={isAr ? "العنوان" : "Address"} value={address} onChange={(event) => setAddress(event.target.value)} />
          <input className="admin-input" placeholder={isAr ? "رمز الخصم (اختياري)" : "Promo code (optional)"} value={promoCode} onChange={(event) => setPromoCode(event.target.value)} list="promo-list" />
          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" checked={applyPromotion} onChange={(event) => setApplyPromotion(event.target.checked)} />
            {isAr ? "تطبيق العرض على الطلب" : "Apply promotion to this order"}
          </label>
          <select className="admin-select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CARD_POS" | "CARD_ONLINE" | "CASH")}>
            <option value="CARD_POS">{isAr ? "بطاقة نقطة بيع" : "Card POS"}</option>
            <option value="CARD_ONLINE">{isAr ? "بطاقة أونلاين" : "Card Online"}</option>
            <option value="CASH">{isAr ? "نقدًا" : "Cash"}</option>
          </select>
          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" checked={createAccount} onChange={(event) => setCreateAccount(event.target.checked)} />
            {isAr ? "إنشاء حساب للعميل" : "Create customer account"}
          </label>
          {createAccount ? <input className="admin-input" type="password" placeholder={isAr ? "كلمة مرور الحساب" : "Account password"} value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /> : null}
        </div>

        <div className="admin-card" style={{ marginTop: 10, padding: 10, background: "#fffaf2" }}>
          <div className="admin-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b>{isAr ? "العروض النشطة في المتجر" : "Active website promotions"}</b>
            {promoCode || applyPromotion ? <button className="btn" type="button" onClick={clearPromotionCode}>{isAr ? "حذف العرض" : "Remove promo"}</button> : null}
          </div>
          <div className="admin-row" style={{ gap: 8 }}>
            {promos.map((promo) => {
              const code = String(promo.code || "").trim();
              const title = isAr ? (promo.title_ar || promo.title_en || "عرض") : (promo.title_en || promo.title_ar || "Promotion");
              const active = applyPromotion && code && promoCode.trim().toLowerCase() === code.toLowerCase();
              return (
                <div key={promo.id} className="admin-row" style={{ gap: 6, border: "1px solid rgba(0,0,0,.1)", borderRadius: 999, padding: "6px 10px", background: active ? "#f0f7ef" : "#fff" }}>
                  <span style={{ fontSize: 12 }}><b>{title}</b>{code ? ` (${code})` : ""}</span>
                  {code ? (
                    <button className="btn" type="button" onClick={() => applyPromotionCode(code)}>{active ? (isAr ? "مُطبّق" : "Applied") : (isAr ? "إضافة" : "Add")}</button>
                  ) : (
                    <span className="admin-muted" style={{ fontSize: 12 }}>{isAr ? "تلقائي" : "Auto"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <datalist id="promo-list">{promos.map((promo) => (<option key={promo.id} value={promo.code || ""}>{isAr ? (promo.title_ar || promo.title_en || "عرض") : (promo.title_en || promo.title_ar || "Promotion")}</option>))}</datalist>

        <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <b>{isAr ? "المجموع الفرعي" : "Subtotal"}</b>
          <b>{money(subtotal)}</b>
        </div>
        {applyPromotion ? (
          <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 6 }}>
            <b>{isAr ? "الخصم" : "Discount"}</b>
            <b>-{money(promoQuote.discountJod)}</b>
          </div>
        ) : null}
        <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 6 }}>
          <b>{isAr ? "الإجمالي بعد الخصم" : "Total after discount"}</b>
          <b>{money(applyPromotion ? promoQuote.subtotalAfterDiscountJod : subtotal)}</b>
        </div>
        {applyPromotion && promoQuote.checking ? <p className="admin-muted" style={{ marginTop: 8 }}>{isAr ? "جارٍ التحقق من العرض..." : "Validating promotion..."}</p> : null}
        {applyPromotion && promoQuote.error ? <p className="admin-muted" style={{ marginTop: 8, color: "#b91c1c" }}>{promoQuote.error}</p> : null}
        <button className="btn btn-primary" onClick={checkout} disabled={loading || cartRows.length === 0 || (applyPromotion && promoQuote.checking)} style={{ marginTop: 8 }}>
          {loading ? (isAr ? "جارٍ المعالجة..." : "Processing...") : (isAr ? "تأكيد البيع" : "Confirm Sale")}
        </button>
        {msg ? <p className="admin-muted" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>{isAr ? "طلبات المبيعات الخاصة بي" : "My Sales Orders"}</h3>
        <div className="admin-row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <select className="admin-select" value={ordersStatusFilter} onChange={(event) => setOrdersStatusFilter(event.target.value as "" | "PAID" | "BACKORDER")}>
            <option value="">{isAr ? "كل الحالات" : "All statuses"}</option>
            <option value="PAID">{isAr ? "مدفوع" : "Paid"}</option>
            <option value="BACKORDER">{isAr ? "طلب مؤجل" : "Backorder"}</option>
          </select>
          <select className="admin-select" value={ordersLimit} onChange={(event) => setOrdersLimit(Number(event.target.value) as 10 | 20 | 30)}>
            <option value={10}>{isAr ? "آخر 10" : "Latest 10"}</option>
            <option value={20}>{isAr ? "آخر 20" : "Latest 20"}</option>
            <option value={30}>{isAr ? "آخر 30" : "Latest 30"}</option>
          </select>
          <input className="admin-input" type="date" aria-label={isAr ? "من تاريخ" : "From date"} value={ordersFrom} onChange={(event) => setOrdersFrom(event.target.value)} />
          <input className="admin-input" type="date" aria-label={isAr ? "إلى تاريخ" : "To date"} value={ordersTo} onChange={(event) => setOrdersTo(event.target.value)} />
          <button className="btn" type="button" onClick={() => void load(0)}>{isAr ? "تحديث" : "Refresh"}</button>
          <button className="btn" type="button" onClick={resetOrdersFilters}>{isAr ? "إعادة ضبط" : "Reset"}</button>
          <button className="btn" type="button" disabled={ordersOffset <= 0 || ordersLoading} onClick={() => void load(Math.max(0, ordersOffset - ordersLimit), false)}>{isAr ? "السابق" : "Previous"}</button>
          <button className="btn" type="button" disabled={!ordersHasMore || ordersLoading} onClick={() => void load(ordersOffset + ordersLimit, true)}>{isAr ? "عرض المزيد" : "Show more"}</button>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table sales-orders-table">
            <thead>
              <tr>
                <th>{isAr ? "الرقم" : "#"}</th>
                <th>{isAr ? "التاريخ" : "Created"}</th>
                <th>{isAr ? "العميل" : "Customer"}</th>
                <th>{isAr ? "البريد" : "Email"}</th>
                <th>{isAr ? "الهاتف" : "Phone"}</th>
                <th>{isAr ? "الدفع" : "Payment"}</th>
                <th>{isAr ? "العناصر" : "Items"}</th>
                <th>{isAr ? "الكمية" : "Qty"}</th>
                <th>{isAr ? "الحالة" : "Status"}</th>
                <th style={{ textAlign: "right" }}>{isAr ? "الإجمالي" : "Amount"}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label={isAr ? "الرقم" : "ID"}>#{order.id}</td>
                  <td data-label={isAr ? "التاريخ" : "Created"}>{new Date(order.created_at).toLocaleString(isAr ? "ar-JO" : "en-GB")}</td>
                  <td data-label={isAr ? "العميل" : "Customer"}>{order.customer_name || "—"}</td>
                  <td data-label={isAr ? "البريد" : "Email"}>{order.customer_email || "—"}</td>
                  <td data-label={isAr ? "الهاتف" : "Phone"}>{order.customer_phone || "—"}</td>
                  <td data-label={isAr ? "الدفع" : "Payment"}>{paymentLabel(order.payment_method)}</td>
                  <td data-label={isAr ? "العناصر" : "Items"}>{order.item_lines ?? 0}</td>
                  <td data-label={isAr ? "الكمية" : "Qty"}>{order.item_qty_total ?? 0}</td>
                  <td data-label={isAr ? "الحالة" : "Status"}>{statusLabel(order.status)}</td>
                  <td data-label={isAr ? "الإجمالي" : "Amount"} style={{ textAlign: "right" }}>{money(Number(order.total_jod || 0))}</td>
                </tr>
              ))}
            {orders.length === 0 ? (
              <tr><td data-label={isAr ? "الحالة" : "Status"} colSpan={10} style={{ padding: 12 }}>{isAr ? "لا توجد طلبات مبيعات ضمن المرشحات." : "No sales orders in current filters."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {ordersLoading ? <p className="admin-muted" style={{ marginTop: 8 }}>{isAr ? "جارٍ تحميل الطلبات..." : "Loading orders..."}</p> : null}
      </div>
    </div>
  );
}
