"use client";

import { useEffect, useMemo, useState } from "react";
import { CART_LOCAL_KEY } from "@/lib/cartStore";

type Locale = "en" | "ar";
function t(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

type CartItem = { slug: string; name: string; priceJod: number; qty: number };

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_LOCAL_KEY);
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) return [];
    return items
      .map((i: any) => ({
        slug: String(i.slug || "").trim(),
        name: String(i.name || "").trim(),
        priceJod: Number(i.priceJod || 0),
        qty: Math.max(1, Number(i.qty || 1)),
      }))
      .filter((i) => i.slug && i.name);
  } catch {
    return [];
  }
}

function writeCart(items: CartItem[]) {
  localStorage.setItem(CART_LOCAL_KEY, JSON.stringify(items));
}

export default function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [items, setItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Jordan");

  const [createAccount, setCreateAccount] = useState(true); // checked by default
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");

  useEffect(() => {
    params.then((p) => setLocale(p.locale === "ar" ? "ar" : "en"));
    setItems(readCart());
  }, [params]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.priceJod * i.qty, 0), [items]);
  const shipping = 3.5;
  const total = subtotal + (items.length ? shipping : 0);

  const canSubmit = useMemo(() => {
    if (!items.length) return false;
    return !!fullName.trim() && !!email.trim() && !!phone.trim() && !!addressLine1.trim();
  }, [items, fullName, email, phone, addressLine1]);

  function updateQty(slug: string, qty: number) {
    const next = items.map((i) => (i.slug === slug ? { ...i, qty: Math.max(1, qty) } : i));
    setItems(next);
    writeCart(next);
    setMsg(null);
    setErr(null);
  }

  function removeItem(slug: string) {
    const next = items.filter((i) => i.slug !== slug);
    setItems(next);
    writeCart(next);
    setMsg(null);
    setErr(null);
  }

  async function clearCartServerIfAuthed() {
    // If logged in, clear server cart too
    await fetch("/api/cart/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [] }),
    }).catch(() => {});
  }

  async function submit(e: any) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    setBusy(true);
    setMsg(null);
    setErr(null);

    const payload = {
      items,
      customer: { fullName, email, phone },
      shipping: { addressLine1, city, country },
      createAccount,
      paymentMethod: paymentMethod === "CARD" ? "PAYTABS" : "COD",
      locale,
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      setBusy(false);
      setErr(data?.error || t(locale, "Checkout failed.", "فشل إتمام الطلب."));
      return;
    }

    const cartId = String(data.cartId || "");
    const amountJod = Number(data.amountJod || total);

    if (paymentMethod === "COD") {
      // clear local + server cart
      writeCart([]);
      setItems([]);
      await clearCartServerIfAuthed();
      setBusy(false);
      setMsg(t(locale, "Order placed successfully (Cash on Delivery).", "تم إنشاء الطلب بنجاح (الدفع عند الاستلام)."));
      return;
    }

    // Card: initiate PayTabs
    const pt = await fetch("/api/paytabs/initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartId, amountJod }),
    });
    const ptData = await pt.json().catch(() => ({}));
    if (!pt.ok || !ptData?.ok || !ptData?.redirectUrl) {
      setBusy(false);
      setErr(ptData?.error || t(locale, "Payment init failed.", "فشل تهيئة الدفع."));
      return;
    }

    window.location.href = ptData.redirectUrl;
  }

  return (
    <div style={{ padding: "1.2rem 0", maxWidth: 980 }}>
      <h1 className="title">{t(locale, "Checkout", "الدفع")}</h1>

      {!items.length ? (
        <div className="panel">
          <p className="muted">{t(locale, "Your cart is empty.", "سلة التسوق فارغة.")}</p>
          <a className="btn" href={`/${locale}/product`}>
            {t(locale, "Back to shop", "العودة للمتجر")}
          </a>
        </div>
      ) : (
        <div className="grid2" style={{ alignItems: "start" }}>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>{t(locale, "Your items", "المنتجات")}</h3>

            <div style={{ display: "grid", gap: 10 }}>
              {items.map((i) => (
                <div key={i.slug} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                  <div>
                    <strong>{i.name}</strong>
                    <div className="muted" style={{ marginTop: 2 }}>
                      {i.priceJod.toFixed(2)} JOD
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      aria-label="qty"
                      type="number"
                      min={1}
                      value={i.qty}
                      onChange={(e) => updateQty(i.slug, Number(e.target.value))}
                      style={{ width: 80 }}
                    />
                    <button type="button" className="btn btn-outline" onClick={() => removeItem(i.slug)}>
                      {t(locale, "Remove", "حذف")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ margin: "14px 0" }} />

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Subtotal", "المجموع الفرعي")}</span>
                <strong>{subtotal.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Shipping", "التوصيل")}</span>
                <strong>{shipping.toFixed(2)} JOD</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t(locale, "Total", "الإجمالي")}</span>
                <strong>{total.toFixed(2)} JOD</strong>
              </div>
            </div>
          </div>

          <form className="panel" onSubmit={submit}>
            <h3 style={{ marginTop: 0 }}>{t(locale, "Delivery details", "بيانات التوصيل")}</h3>

            <label>
              <span className="muted">{t(locale, "Full name *", "الاسم الكامل *")}</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Email *", "البريد الإلكتروني *")}</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Phone *", "الهاتف *")}</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>

            <label style={{ marginTop: 10 }}>
              <span className="muted">{t(locale, "Address *", "العنوان *")}</span>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} required />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <label>
                <span className="muted">{t(locale, "City", "المدينة")}</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label>
                <span className="muted">{t(locale, "Country", "الدولة")}</span>
                <input value={country} onChange={(e) => setCountry(e.target.value)} />
              </label>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
              <span className="muted">
                {t(locale, "Create an account for me (recommended)", "إنشاء حساب لي (موصى به)")}
              </span>
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className={"btn" + (paymentMethod === "CARD" ? "" : " btn-outline")}
                onClick={() => setPaymentMethod("CARD")}
              >
                {t(locale, "Pay by card", "الدفع بالبطاقة")}
              </button>
              <button
                type="button"
                className={"btn" + (paymentMethod === "COD" ? "" : " btn-outline")}
                onClick={() => setPaymentMethod("COD")}
              >
                {t(locale, "Cash on delivery", "الدفع عند الاستلام")}
              </button>
            </div>

            {err ? <p style={{ color: "crimson", marginTop: 10 }}>{err}</p> : null}
            {msg ? <p style={{ color: "green", marginTop: 10 }}>{msg}</p> : null}

            <button className={"btn" + (!canSubmit || busy ? " btn-disabled" : "")} disabled={!canSubmit || busy} style={{ marginTop: 12 }}>
              {busy ? t(locale, "Please wait…", "يرجى الانتظار…") : t(locale, "Place order", "تأكيد الطلب")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
