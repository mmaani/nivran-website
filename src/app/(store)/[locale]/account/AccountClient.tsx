"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readJsonSafe } from "@/lib/http";

type Profile = {
  id: number;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  address_line1: string | null;
  city: string | null;
  is_verified: boolean | string | number | null;
};

type OrderListRow = {
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
};

type OrderItemLine = {
  id?: number;
  qty?: number;
  variant_id?: number;
  variantId?: number;
  product_slug?: string | null;
  productSlug?: string | null;
  slug?: string | null;
};

type OrderInsight = {
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

type CartReorderItem = { slug: string; qty: number; variantId: number | null };
type ReorderMode = "replace" | "add";

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value);
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

function toQty(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(99, Math.trunc(n)));
}

function pickSlug(line: OrderItemLine): string | null {
  const a = typeof line.product_slug === "string" ? line.product_slug : null;
  const b = typeof line.productSlug === "string" ? line.productSlug : null;
  const c = typeof line.slug === "string" ? line.slug : null;
  const s = (a || b || c || "").trim();
  return s ? s : null;
}

function asBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "t" || s === "yes" || s === "y";
  }
  return false;
}

function chipClass(statusRaw: string): string {
  const s = String(statusRaw || "").toUpperCase();
  if (!s) return "chip chip--neutral";
  if (s.includes("PAID")) return "chip chip--paid";
  if (s.includes("DELIVER")) return "chip chip--delivered";
  if (s.includes("SHIP")) return "chip chip--shipped";
  if (s.includes("PENDING")) return "chip chip--pending";
  if (s.includes("FAIL") || s.includes("CANCEL")) return "chip chip--failed";
  return "chip chip--neutral";
}

type CountryOption = { code: string; en: string; ar: string };

const COUNTRIES: CountryOption[] = [
  { code: "JO", en: "Jordan", ar: "الأردن" },
  { code: "SA", en: "Saudi Arabia", ar: "السعودية" },
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات" },
  { code: "KW", en: "Kuwait", ar: "الكويت" },
  { code: "QA", en: "Qatar", ar: "قطر" },
  { code: "BH", en: "Bahrain", ar: "البحرين" },
  { code: "OM", en: "Oman", ar: "عُمان" },
  { code: "IQ", en: "Iraq", ar: "العراق" },
  { code: "LB", en: "Lebanon", ar: "لبنان" },
  { code: "EG", en: "Egypt", ar: "مصر" },
  { code: "PS", en: "Palestine", ar: "فلسطين" },
  { code: "SY", en: "Syria", ar: "سوريا" },
  { code: "TR", en: "Turkey", ar: "تركيا" },
  { code: "US", en: "United States", ar: "الولايات المتحدة" },
  { code: "GB", en: "United Kingdom", ar: "المملكة المتحدة" },
  { code: "FR", en: "France", ar: "فرنسا" },
  { code: "DE", en: "Germany", ar: "ألمانيا" },
  { code: "IT", en: "Italy", ar: "إيطاليا" },
  { code: "ES", en: "Spain", ar: "إسبانيا" },
  { code: "CA", en: "Canada", ar: "كندا" },
];

function normalizeCountryInput(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function findCountryLabel(value: string, isAr: boolean): string {
  const v = normalizeCountryInput(value);
  if (!v) return "";
  const hit =
    COUNTRIES.find((c) => c.code.toLowerCase() === v.toLowerCase()) ||
    COUNTRIES.find((c) => c.en.toLowerCase() === v.toLowerCase()) ||
    COUNTRIES.find((c) => c.ar === v);
  if (!hit) return v;
  return isAr ? hit.ar : hit.en;
}

export default function AccountClient({ locale }: { locale: string }) {
  const isAr = locale === "ar";

  const COPY = useMemo(
    () => ({
      verified: isAr ? "موثق" : "Verified",
      unverified: isAr ? "غير موثق" : "Unverified",

      fullName: isAr ? "الاسم الكامل *" : "Full name *",
      email: isAr ? "البريد الإلكتروني" : "Email",
      phone: isAr ? "الهاتف *" : "Phone *",
      country: isAr ? "الدولة" : "Country",
      countryPlaceholder: isAr ? "ابحث عن دولة..." : "Search a country...",
      address: isAr ? "العنوان *" : "Address *",
      city: isAr ? "المدينة" : "City",

      update: isAr ? "تحديث" : "Update",
      updating: isAr ? "جارٍ التحديث..." : "Updating...",
      updated: isAr ? "تم التحديث." : "Updated.",
      error: isAr ? "حدث خطأ. حاول مرة أخرى." : "Something went wrong. Please try again.",
      none: "—",

      details: isAr ? "التفاصيل" : "Details",
      reorder: isAr ? "إعادة الطلب" : "Re-order",
      reorderTitle: isAr ? "إعادة الطلب" : "Re-order",
      reorderBody: isAr ? "اختر طريقة إضافة المنتجات إلى السلة." : "Choose how you want to add these items to your cart.",
      reorderHint: isAr ? "يمكنك دمج الطلب مع سلتك الحالية أو البدء من جديد." : "You can merge this order with your current cart or start with a new cart.",
      startFresh: isAr ? "ابدأ بسلة جديدة" : "Start fresh",
      startFreshDesc: isAr ? "حذف العناصر الحالية وإضافة عناصر هذا الطلب فقط." : "Clear current cart and add only this order items.",
      addToCart: isAr ? "أضف إلى السلة الحالية" : "Add to existing cart",
      addToCartDesc: isAr ? "الاحتفاظ بعناصر السلة الحالية وإضافة هذا الطلب فوقها." : "Keep current cart items and add this order on top.",
      cancel: isAr ? "إلغاء" : "Cancel",
      selectedOrder: isAr ? "الطلب المحدد" : "Selected order",

      emptyOrders: isAr ? "لا توجد طلبات بعد." : "No orders yet.",
      amount: isAr ? "المبلغ" : "Amount",
      status: isAr ? "الحالة" : "Status",
      created: isAr ? "التاريخ" : "Created",
      id: isAr ? "رقم" : "ID",
      promo: isAr ? "خصم" : "Discount",
      accountTitle: isAr ? "الحساب" : "Account",
      sendVerification: isAr ? "تحقق من البريد" : "Verify email",
      loggingOut: isAr ? "جارٍ تسجيل الخروج..." : "Logging out...",
      logout: isAr ? "تسجيل الخروج" : "Logout",
      reorderLoading: isAr ? "جارٍ التحضير..." : "Preparing...",
      reorderSuccess: isAr ? "تم تجهيز الطلب. يتم تحويلك للسلة..." : "Order prepared. Redirecting to your cart...",
      reorderNoItems: isAr ? "لا يمكن إعادة الطلب لهذا الطلب حالياً." : "We couldn't rebuild this order yet.",
      close: isAr ? "إغلاق" : "Close",
      overviewOrders: isAr ? "إجمالي الطلبات" : "Total orders",
      overviewSpent: isAr ? "إجمالي الإنفاق" : "Total spent",
      overviewLast: isAr ? "آخر طلب" : "Last order",
      noDate: isAr ? "لا يوجد" : "N/A",
      ordersTitle: isAr ? "طلباتك" : "Your Orders",
      verifySending: isAr ? "جارٍ الإرسال..." : "Sending...",
    }),
    [isAr]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");

  // IMPORTANT: popup-based reorder state (fixes your compile mismatch)
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [reorderOrderId, setReorderOrderId] = useState<number | null>(null);
  const [reorderMode, setReorderMode] = useState<ReorderMode>("add");
  const [authBusy, setAuthBusy] = useState<"verify" | "logout" | null>(null);

  // Country combobox
  const countryWrapRef = useRef<HTMLDivElement | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [countryActiveIdx, setCountryActiveIdx] = useState(0);
  const reorderPrimaryRef = useRef<HTMLButtonElement | null>(null);

  const verified = useMemo(() => asBool(profile?.is_verified), [profile?.is_verified]);

  const orderInsight = useMemo<OrderInsight>(() => {
    if (!orders.length) return { totalOrders: 0, totalSpent: 0, lastOrderAt: null };

    let totalSpent = 0;
    let latestTime = 0;
    let latestRaw: string | null = null;

    for (const row of orders) {
      const amount = Number(row.total_jod ?? row.amount_jod ?? 0);
      if (Number.isFinite(amount)) totalSpent += amount;

      const created = Date.parse(row.created_at);
      if (Number.isFinite(created) && created > latestTime) {
        latestTime = created;
        latestRaw = row.created_at;
      }
    }

    return {
      totalOrders: orders.length,
      totalSpent,
      lastOrderAt: latestRaw,
    };
  }, [orders]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [orders]);

  const selectedReorderOrder = useMemo(() => {
    if (!reorderOrderId) return null;
    return orders.find((item) => item.id === reorderOrderId) ?? null;
  }, [orders, reorderOrderId]);

  const canSave = useMemo(() => {
    if (!fullName.trim()) return false;
    if (!phone.trim()) return false;
    if (!addressLine1.trim()) return false;
    return true;
  }, [fullName, phone, addressLine1]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    const a = (profile.full_name || "").trim();
    const b = (profile.phone || "").trim();
    const c = (profile.country || "").trim();
    const d = (profile.address_line1 || "").trim();
    const e = (profile.city || "").trim();
    return (
      a !== fullName.trim() ||
      b !== phone.trim() ||
      c !== country.trim() ||
      d !== addressLine1.trim() ||
      e !== city.trim()
    );
  }, [profile, fullName, phone, country, addressLine1, city]);

  const countryOptions = useMemo(() => {
    const q = normalizeCountryInput(countryQuery).toLowerCase();
    const items = COUNTRIES.map((c) => ({
      code: c.code,
      label: isAr ? c.ar : c.en,
      alt: isAr ? c.en : c.ar,
      search: `${c.code} ${c.en} ${c.ar}`.toLowerCase(),
    }));
    const filtered = q ? items.filter((x) => x.search.includes(q)) : items;
    return filtered.slice(0, 24);
  }, [countryQuery, isAr]);

  function syncCountryQueryFromValue() {
    const label = findCountryLabel(country, isAr);
    setCountryQuery(label);
  }

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const el = countryWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setCountryOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setMsg(null);

      try {
        const pr = await fetch("/api/auth/profile", { cache: "no-store" });
        const pj: unknown = await readJsonSafe(pr);
        if (!alive) return;

        if (!pr.ok || !pj || typeof pj !== "object" || (pj as Record<string, unknown>).ok !== true) {
          setLoading(false);
          return;
        }

        const p = (pj as Record<string, unknown>).profile as Profile;
        setProfile(p);

        setFullName((p.full_name || "").trim());
        setPhone((p.phone || "").trim());
        setCountry((p.country || "").trim());
        setAddressLine1((p.address_line1 || "").trim());
        setCity((p.city || "").trim());

        const initLabel = findCountryLabel((p.country || "").trim(), isAr);
        setCountryQuery(initLabel);

        const or = await fetch("/api/orders", { cache: "no-store" });
        const oj: unknown = await readJsonSafe(or);
        if (!alive) return;

        if (or.ok && oj && typeof oj === "object" && (oj as Record<string, unknown>).ok === true) {
          const list = ((oj as Record<string, unknown>).orders || []) as OrderListRow[];
          setOrders(Array.isArray(list) ? list : []);
        } else {
          setOrders([]);
        }
      } catch {
        setOrders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncCountryQueryFromValue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAr]);


  useEffect(() => {
    if (!reorderOpen) return;

    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !reorderBusy) {
        setReorderOpen(false);
        setReorderOrderId(null);
        setReorderMode("add");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => reorderPrimaryRef.current?.focus(), 30);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
    };
  }, [reorderBusy, reorderOpen]);

  async function saveProfile() {
    if (!canSave) return;
    if (!isDirty) return;

    setSaving(true);
    setMsg(null);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          country: country.trim() || null,
          address_line1: addressLine1.trim(),
          city: city.trim() || null,
        }),
      });

      const data: unknown = await readJsonSafe(res);

      if (!res.ok || !data || typeof data !== "object" || (data as Record<string, unknown>).ok !== true) {
        setMsg(COPY.error);
        return;
      }

      const r = await fetch("/api/auth/profile", { cache: "no-store" });
      const j: unknown = await readJsonSafe(r);
      if (r.ok && j && typeof j === "object" && (j as Record<string, unknown>).ok === true) {
        const p = (j as Record<string, unknown>).profile as Profile;
        setProfile(p);
      }

      setMsg(COPY.updated);
    } catch {
      setMsg(COPY.error);
    } finally {
      setSaving(false);
    }
  }

  function openReorder(orderId: number) {
    setReorderOrderId(orderId);
    setReorderMode("add");
    setReorderOpen(true);
    setMsg(null);
  }

  function closeReorder() {
    if (reorderBusy) return;
    setReorderOpen(false);
    setReorderOrderId(null);
    setReorderMode("add");
  }

  async function applyReorder(mode: ReorderMode) {
    if (!reorderOrderId) return;

    setReorderBusy(true);
    try {
      const res = await fetch(`/api/orders?id=${reorderOrderId}&includeItems=1`, { cache: "no-store" });
      const data: unknown = await readJsonSafe(res);

      if (!res.ok || !data || typeof data !== "object" || (data as Record<string, unknown>).ok !== true) {
        setMsg(COPY.error);
        return;
      }

      const orderObj = (data as Record<string, unknown>).order as Record<string, unknown> | undefined;
      const normalizedLines = orderObj?.line_items;
      const legacyLines = orderObj?.items;

      const normalizedList = Array.isArray(normalizedLines) ? (normalizedLines as OrderItemLine[]) : [];
      const legacyList = Array.isArray(legacyLines) ? (legacyLines as OrderItemLine[]) : [];

      const slugByVariant = new Map<number, string>();
      for (const legacy of legacyList) {
        const variantId = toInt(legacy.variant_id ?? legacy.variantId);
        const slug = pickSlug(legacy);
        if (variantId && slug && !slugByVariant.has(variantId)) slugByVariant.set(variantId, slug);
      }

      const mappedNormalized: CartReorderItem[] = normalizedList
        .map((line) => {
          const variantId = toInt(line.variant_id ?? line.variantId);
          const directSlug = pickSlug(line);
          const slug = directSlug || (variantId ? slugByVariant.get(variantId) || null : null);
          if (!slug) return null;
          return { slug, qty: toQty(line.qty), variantId: variantId ?? null };
        })
        .filter((entry): entry is CartReorderItem => entry !== null);

      const mappedLegacy: CartReorderItem[] = legacyList
        .map((line) => {
          const slug = pickSlug(line);
          if (!slug) return null;
          const variantId = toInt(line.variant_id ?? line.variantId);
          return { slug, qty: toQty(line.qty), variantId: variantId ?? null };
        })
        .filter((entry): entry is CartReorderItem => entry !== null);

      const mapped = mappedNormalized.length ? mappedNormalized : mappedLegacy;

      if (!mapped.length) {
        setMsg(COPY.reorderNoItems);
        return;
      }

      sessionStorage.setItem("nivran_reorder_payload_v1", JSON.stringify({ items: mapped, mode }));
      setMsg(COPY.reorderSuccess);
      const qs = new URLSearchParams({
        reorder: "1",
        orderId: String(reorderOrderId),
        mode,
      });
      window.location.href = `/${locale}/cart?${qs.toString()}`;
    } catch {
      setMsg(COPY.error);
    } finally {
      setReorderBusy(false);
      setReorderOpen(false);
      setReorderOrderId(null);
      setReorderMode("add");
    }
  }

  async function startVerification() {
    if (!profile || verified || authBusy) return;
    setAuthBusy("verify");
    setMsg(null);

    try {
      const res = await fetch("/api/auth/verify/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data: unknown = await readJsonSafe(res);
      if (!res.ok || !data || typeof data !== "object" || (data as Record<string, unknown>).ok !== true) {
        setMsg(COPY.error);
        return;
      }
      window.location.href = `/${locale}/account/verify?email=${encodeURIComponent(profile.email)}`;
    } catch {
      setMsg(COPY.error);
    } finally {
      setAuthBusy(null);
    }
  }

  async function logout() {
    if (authBusy) return;
    setAuthBusy("logout");
    setMsg(null);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = `/${locale}/account/login`;
    } catch {
      setMsg(COPY.error);
      setAuthBusy(null);
    }
  }

  function chooseCountry(label: string, code?: string) {
    const v = normalizeCountryInput(label);
    setCountry(v || (code ? code : ""));
    setCountryQuery(v);
    setCountryOpen(false);
  }

  function formatDate(raw: string | null): string {
    if (!raw) return COPY.noDate;
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return COPY.noDate;
    return date.toLocaleDateString(locale === "ar" ? "ar" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function onCountryKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!countryOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setCountryOpen(true);
      setCountryActiveIdx(0);
      return;
    }

    if (!countryOpen) return;

    if (e.key === "Escape") {
      setCountryOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCountryActiveIdx((i) => Math.min(countryOptions.length - 1, i + 1));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCountryActiveIdx((i) => Math.max(0, i - 1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const picked = countryOptions[countryActiveIdx];
      if (picked) chooseCountry(picked.label, picked.code);
    }
  }

  if (loading) {
    return (
      <div className="account-shell">
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>{isAr ? "جارٍ التحميل..." : "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="account-shell">
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>{isAr ? "يرجى تسجيل الدخول أولاً." : "Please log in first."}</p>
          <div style={{ marginTop: 12 }}>
            <a className="btn primary" href={`/${locale}/account/login`}>
              {isAr ? "تسجيل الدخول" : "Login"}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-shell">
      <div className="account-grid account-grid-stack">
        <div className="card card-soft account-panel">
          <div className="account-head">
            <div>
              <h1 className="account-title">{COPY.accountTitle}</h1>
              <p className="account-subtitle" style={{ marginBottom: 0 }}>
                <span className={"badge " + (verified ? "badge-verified" : "")}>
                  {verified ? COPY.verified : COPY.unverified}
                </span>
              </p>
            </div>
            <div className="account-actions">
              {!verified ? (
                <button className="btn btn-quiet" onClick={startVerification} disabled={authBusy !== null}>
                  {authBusy === "verify" ? COPY.verifySending : COPY.sendVerification}
                </button>
              ) : null}
              <button className="btn" onClick={logout} disabled={authBusy !== null}>
                {authBusy === "logout" ? COPY.loggingOut : COPY.logout}
              </button>
            </div>
          </div>

          {msg ? (
            <div className="account-feedback" role="status" aria-live="polite">
              <p className="muted" style={{ margin: 0 }}>{msg}</p>
              <button type="button" className="btn btn-quiet" onClick={() => setMsg(null)}>
                {COPY.close}
              </button>
            </div>
          ) : null}

          <div className="field-grid">
            <div className="field">
              <label className="field-label">{COPY.fullName}</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="field">
              <label className="field-label">{COPY.email}</label>
              <input className="input" value={profile.email} readOnly />
            </div>

            <div className="field">
              <label className="field-label">{COPY.phone}</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            </div>

            <div className="field" ref={countryWrapRef}>
              <label className="field-label">{COPY.country}</label>
              <div className="country-combobox">
                <input
                  className="input country-input"
                  value={countryQuery}
                  placeholder={COPY.countryPlaceholder}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCountryQuery(v);
                    setCountry(normalizeCountryInput(v));
                    setCountryOpen(true);
                    setCountryActiveIdx(0);
                  }}
                  onFocus={() => {
                    setCountryOpen(true);
                    setCountryActiveIdx(0);
                  }}
                  onKeyDown={onCountryKeyDown}
                  role="combobox"
                  aria-expanded={countryOpen}
                  aria-haspopup="listbox"
                  aria-controls="country-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={countryOpen ? `country-opt-${countryActiveIdx}` : undefined}
                />

                <button
                  type="button"
                  className="btn btn-quiet country-toggle"
                  onClick={() => setCountryOpen((v) => !v)}
                  aria-label={isAr ? "فتح قائمة الدول" : "Open countries"}
                >
                  ▾
                </button>

                {countryOpen ? (
                  <div className="country-popover" role="listbox" id="country-listbox">
                    {countryOptions.length === 0 ? (
                      <div className="country-empty muted">{isAr ? "لا نتائج" : "No results"}</div>
                    ) : (
                      countryOptions.map((opt, idx) => (
                        <button
                          key={opt.code + opt.label}
                          id={`country-opt-${idx}`}
                          type="button"
                          role="option"
                          aria-selected={idx === countryActiveIdx}
                          className={"country-option" + (idx === countryActiveIdx ? " is-active" : "")}
                          onMouseEnter={() => setCountryActiveIdx(idx)}
                          onClick={() => chooseCountry(opt.label, opt.code)}
                        >
                          <span>{opt.label}</span>
                          <span className="muted" style={{ fontSize: ".82rem" }}>{opt.code}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">{COPY.address}</label>
              <input className="input" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>

            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field-label">{COPY.city}</label>
              <input className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>

          <div className="actions-row" style={{ marginTop: 14 }}>
            <button
              className={"btn primary" + (!canSave || !isDirty || saving ? " btn-disabled" : "")}
              disabled={!canSave || !isDirty || saving}
              onClick={saveProfile}
            >
              {saving ? COPY.updating : COPY.update}
            </button>
          </div>
        </div>

        <div className="card account-panel">
          <div className="orders-overview" aria-label={COPY.ordersTitle}>
            <div className="overview-item">
              <span className="muted">{COPY.overviewOrders}</span>
              <strong>{orderInsight.totalOrders}</strong>
            </div>
            <div className="overview-item">
              <span className="muted">{COPY.overviewSpent}</span>
              <strong>{orderInsight.totalSpent.toFixed(2)} JOD</strong>
            </div>
            <div className="overview-item">
              <span className="muted">{COPY.overviewLast}</span>
              <strong>{formatDate(orderInsight.lastOrderAt)}</strong>
            </div>
          </div>

          {orders.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{COPY.emptyOrders}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{COPY.id}</th>
                    <th>{COPY.created}</th>
                    <th>{COPY.status}</th>
                    <th>{COPY.amount}</th>
                    <th>{COPY.promo}</th>
                    <th style={{ width: 220 }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((o) => {
                    const status = String(o.status || "").toUpperCase();
                    const total = o.total_jod ? Number(o.total_jod) : Number(o.amount_jod || 0);
                    const discount = o.discount_jod ? Number(o.discount_jod) : 0;

                    const promoText =
                      o.discount_source && String(o.discount_source).toUpperCase() === "CODE"
                        ? (o.promo_code || "").toString().trim() || COPY.none
                        : discount > 0
                          ? `-${discount.toFixed(2)} JOD`
                          : COPY.none;

                    return (
                      <tr key={o.id}>
                        <td data-label={COPY.id}><strong>#{o.id}</strong></td>
                        <td data-label={COPY.created}>
                          <span className="muted">{new Date(o.created_at).toLocaleString()}</span>
                        </td>
                        <td data-label={COPY.status}>
                          <span className={chipClass(status)}>
                            <span className="chip-dot" />
                            {status}
                          </span>
                        </td>
                        <td data-label={COPY.amount}>
                          <strong>{Number.isFinite(total) ? total.toFixed(2) : "0.00"} JOD</strong>
                        </td>
                        <td data-label={COPY.promo}>
                          <span className="muted">{promoText}</span>
                        </td>
                        <td data-label={COPY.none}>
                          <div className="order-actions">
                            <a className="btn btn-quiet" href={`/${locale}/account/orders/${o.id}`}>
                              {COPY.details}
                            </a>
                            <button className="btn primary" onClick={() => openReorder(o.id)} disabled={reorderBusy}>
                              {reorderBusy && reorderOrderId === o.id ? COPY.reorderLoading : COPY.reorder}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {reorderOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={COPY.reorderTitle} onMouseDown={closeReorder}>
          <div className="modal reorder-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="reorder-modal-head">
              <div>
                <h3>{COPY.reorderTitle}</h3>
                <p className="muted">{COPY.reorderBody}</p>
              </div>
              <button className="btn btn-quiet" onClick={closeReorder} disabled={reorderBusy}>
                {COPY.close}
              </button>
            </div>

            {selectedReorderOrder ? (
              <div className="reorder-selected-order">
                <span className="muted">{COPY.selectedOrder}</span>
                <strong>
                  #{selectedReorderOrder.id} • {formatDate(selectedReorderOrder.created_at)} • {Number(selectedReorderOrder.total_jod ?? selectedReorderOrder.amount_jod ?? 0).toFixed(2)} JOD
                </strong>
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: 0 }}>{COPY.reorderHint}</p>

            <div className="reorder-choice-grid">
              <button
                className={"reorder-choice" + (reorderMode === "add" ? " is-selected" : "")}
                onClick={() => setReorderMode("add")}
                disabled={reorderBusy}
                aria-pressed={reorderMode === "add"}
              >
                <strong>{COPY.addToCart}</strong>
                <span className="muted">{COPY.addToCartDesc}</span>
              </button>

              <button
                className={"reorder-choice" + (reorderMode === "replace" ? " is-selected" : "")}
                onClick={() => setReorderMode("replace")}
                disabled={reorderBusy}
                aria-pressed={reorderMode === "replace"}
              >
                <strong>{COPY.startFresh}</strong>
                <span className="muted">{COPY.startFreshDesc}</span>
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn btn-quiet" onClick={closeReorder} disabled={reorderBusy}>
                {COPY.cancel}
              </button>
              <button ref={reorderPrimaryRef} className="btn primary" onClick={() => applyReorder(reorderMode)} disabled={reorderBusy}>
                {reorderBusy ? COPY.reorderLoading : reorderMode === "add" ? COPY.addToCart : COPY.startFresh}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
