"use client";

import React, { useEffect, useMemo, useState } from "react";

type Product = { id: number; slug: string; name_en: string; name_ar: string; price_jod: string; inventory_qty: number };
type Promo = { id: number; code: string | null; title_en: string | null; discount_type: string; discount_value: string };
type CartLine = { productId: number; qty: number };

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

function money(n: number): string {
  return `${n.toFixed(2)} JOD`;
}

export default function SalesClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [promoCode, setPromoCode] = useState("");
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

  async function load() {
    const [catalogRes, ordersRes] = await Promise.all([
      fetch("/api/admin/sales/catalog", { credentials: "include", cache: "no-store" }),
      fetch("/api/admin/sales/orders", { credentials: "include", cache: "no-store" }),
    ]);
    const catalog = (await catalogRes.json()) as { products: Product[]; promotions: Promo[] };
    const salesOrders = (await ordersRes.json()) as { orders: OrderRow[] };
    setProducts(Array.isArray(catalog.products) ? catalog.products : []);
    setPromos(Array.isArray(catalog.promotions) ? catalog.promotions : []);
    setOrders(Array.isArray(salesOrders.orders) ? salesOrders.orders : []);
  }

  useEffect(() => {
    void load();
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      if (showLowStockOnly && product.inventory_qty > 5) return false;
      if (!q) return true;
      const hay = `${product.name_en} ${product.name_ar} ${product.slug}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, query, showLowStockOnly]);

  const cartRows = useMemo(
    () =>
      cart
        .map((line) => {
          const product = productById.get(line.productId);
          if (!product) return null;
          const unitPrice = Number(product.price_jod);
          return {
            ...line,
            product,
            unitPrice,
            lineTotal: unitPrice * line.qty,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null),
    [cart, productById]
  );

  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart]);
  const subtotal = useMemo(() => cartRows.reduce((sum, row) => sum + row.lineTotal, 0), [cartRows]);

  function updateQty(productId: number, nextQty: number) {
    const qty = Math.max(0, Math.trunc(nextQty));
    setCart((prev) => {
      if (qty <= 0) return prev.filter((line) => line.productId !== productId);
      const found = prev.find((line) => line.productId === productId);
      if (!found) return [...prev, { productId, qty }];
      return prev.map((line) => (line.productId === productId ? { ...line, qty } : line));
    });
  }

  function add(productId: number) {
    const existing = cart.find((line) => line.productId === productId);
    updateQty(productId, (existing?.qty || 0) + 1);
  }

  function clearCart() {
    setCart([]);
  }

  async function checkout() {
    setLoading(true);
    setMsg("");

    if (!name.trim() || !email.trim() || !phone.trim() || !city.trim() || !address.trim()) {
      setMsg("Please complete customer information before checkout.");
      setLoading(false);
      return;
    }

    if (createAccount && !accountPassword.trim()) {
      setMsg("Please enter account password when account creation is enabled.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/sales/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: cart,
          promoCode: promoCode.trim() || undefined,
          customer: { name, email, phone, city, address, country: "Jordan" },
          paymentMethod,
          createAccount,
          accountPassword: createAccount ? accountPassword : undefined,
        }),
      });

      const data = (await res.json()) as { ok: boolean; orderId?: number; statusCode?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Checkout failed");

      setMsg(`Sale completed. Order #${data.orderId || ""}${data.statusCode === "BACKORDER" ? " (Backorder created)" : ""}`);
      setCart([]);
      setPromoCode("");
      await load();
    } catch (error: unknown) {
      setMsg(error instanceof Error ? error.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-grid" style={{ gap: 16 }}>
      <h1 className="admin-h1">Sales Portal</h1>

      <div className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <div className="admin-card" style={{ padding: 12 }}><b>Visible products</b><div>{visibleProducts.length}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>Promotions</b><div>{promos.length}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>Cart items</b><div>{itemCount}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>Subtotal</b><div>{money(subtotal)}</div></div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>Products</h3>
        <div className="admin-row" style={{ gap: 8, marginBottom: 10 }}>
          <input className="admin-input" placeholder="Search product / slug" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="admin-row" style={{ gap: 6, whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={showLowStockOnly} onChange={(event) => setShowLowStockOnly(event.target.checked)} />
            Low stock only (≤5)
          </label>
        </div>
        <div style={{ display: "grid", gap: 8, maxHeight: 280, overflow: "auto" }}>
          {visibleProducts.map((product) => (
            <div key={product.id} className="admin-row" style={{ justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,.08)", paddingBottom: 8 }}>
              <div>
                <div><b>{product.name_en}</b> <span style={{ opacity: 0.6 }}>({product.slug})</span></div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>{money(Number(product.price_jod))} • Stock {product.inventory_qty}</div>
              </div>
              <button className="btn" onClick={() => add(product.id)}>Add</button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>Cart</h3>
        {cartRows.length === 0 ? <p className="admin-muted">No items in cart.</p> : null}
        {cartRows.map((row) => (
          <div key={row.productId} className="admin-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <b>{row.product.name_en}</b>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{money(row.unitPrice)} each</div>
            </div>
            <div className="admin-row" style={{ gap: 6 }}>
              <button className="btn" onClick={() => updateQty(row.productId, row.qty - 1)}>-</button>
              <input className="admin-input" style={{ width: 64, textAlign: "center" }} value={row.qty} onChange={(event) => updateQty(row.productId, Number(event.target.value || 0))} />
              <button className="btn" onClick={() => updateQty(row.productId, row.qty + 1)}>+</button>
            </div>
            <div style={{ minWidth: 120, textAlign: "right" }}>{money(row.lineTotal)}</div>
          </div>
        ))}
        {cartRows.length > 0 ? (
          <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 8 }}>
            <b>Subtotal</b>
            <b>{money(subtotal)}</b>
          </div>
        ) : null}
        <div className="admin-row" style={{ marginTop: 10 }}>
          <button className="btn" onClick={clearCart} disabled={cartRows.length === 0}>Clear cart</button>
        </div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>Checkout</h3>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
          <input className="admin-input" placeholder="Customer name" value={name} onChange={(event) => setName(event.target.value)} />
          <input className="admin-input" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="admin-input" placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <input className="admin-input" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <input className="admin-input" placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
          <input className="admin-input" placeholder="Promo code" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} list="promo-list" />
          <select className="admin-select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CARD_POS" | "CARD_ONLINE" | "CASH")}>
            <option value="CARD_POS">Card POS</option>
            <option value="CARD_ONLINE">Card Online</option>
            <option value="CASH">Cash</option>
          </select>
          <label className="admin-row" style={{ gap: 8 }}>
            <input type="checkbox" checked={createAccount} onChange={(event) => setCreateAccount(event.target.checked)} />
            Create customer account
          </label>
          {createAccount ? <input className="admin-input" type="password" placeholder="Account password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} /> : null}
        </div>
        <datalist id="promo-list">{promos.map((promo) => (<option key={promo.id} value={promo.code || ""}>{promo.title_en || "Promotion"}</option>))}</datalist>

        <div className="admin-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <b>Amount</b>
          <b>{money(subtotal)}</b>
        </div>
        <button className="btn btn-primary" onClick={checkout} disabled={loading || cart.length === 0} style={{ marginTop: 8 }}>
          {loading ? "Processing..." : "Confirm Sale"}
        </button>
        {msg ? <p className="admin-muted" style={{ marginTop: 10 }}>{msg}</p> : null}
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>My Sales Orders</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Created</th>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Payment</th>
                <th>Items</th>
                <th>Qty</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>#{order.id}</td>
                  <td>{new Date(order.created_at).toLocaleString("en-GB")}</td>
                  <td>{order.customer_name || "—"}</td>
                  <td>{order.customer_email || "—"}</td>
                  <td>{order.customer_phone || "—"}</td>
                  <td>{order.payment_method || "—"}</td>
                  <td>{order.item_lines ?? 0}</td>
                  <td>{order.item_qty_total ?? 0}</td>
                  <td>{order.status || "—"}</td>
                  <td style={{ textAlign: "right" }}>{money(Number(order.total_jod || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
