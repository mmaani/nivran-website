"use client";

import React, { useEffect, useMemo, useState } from "react";

type Product = { id: number; slug: string; name_en: string; name_ar: string; price_jod: string; inventory_qty: number };
type Promo = { id: number; code: string | null; title_en: string | null; discount_type: string; discount_value: string };
type CartLine = { productId: number; qty: number };

type OrderRow = { id: number; customer_name: string; customer_email: string; total_jod: string; status?: string; created_at: string };

export default function SalesClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Amman");
  const [address, setAddress] = useState("");
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

  const total = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, Number(p.price_jod)]));
    return cart.reduce((sum, line) => sum + (map.get(line.productId) || 0) * line.qty, 0);
  }, [cart, products]);

  function add(productId: number) {
    setCart((prev) => {
      const found = prev.find((line) => line.productId === productId);
      if (found) return prev.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line));
      return [...prev, { productId, qty: 1 }];
    });
  }

  async function checkout() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/sales/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: cart,
          promoCode: promoCode.trim() || undefined,
          customer: { name, email, phone, city, address, country: "Jordan" },
          paymentMethod: "CARD_POS",
        }),
      });
      const data = (await res.json()) as { ok: boolean; orderId?: number; statusCode?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Checkout failed");
      setMsg(`Sale completed. Order #${data.orderId || ""}${data.statusCode === "BACKORDER" ? " (Backorder created)" : ""}`);
      setCart([]);
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
      <div className="admin-card" style={{ padding: 14 }}>
        <h3>Products</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {products.map((product) => (
            <div key={product.id} className="admin-row" style={{ justifyContent: "space-between" }}>
              <div>{product.name_en} — {Number(product.price_jod).toFixed(2)} JOD (Stock {product.inventory_qty})</div>
              <button className="btn" onClick={() => add(product.id)}>Add</button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>Checkout</h3>
        <input className="admin-input" placeholder="Customer name" value={name} onChange={(event) => setName(event.target.value)} />
        <input className="admin-input" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="admin-input" placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <input className="admin-input" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
        <input className="admin-input" placeholder="Address" value={address} onChange={(event) => setAddress(event.target.value)} />
        <input className="admin-input" placeholder="Promo code" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} list="promo-list" />
        <datalist id="promo-list">{promos.map((promo) => (<option key={promo.id} value={promo.code || ""}>{promo.title_en || "Promotion"}</option>))}</datalist>
        <p>Total: {total.toFixed(2)} JOD</p>
        <button className="btn btn-primary" onClick={checkout} disabled={loading || cart.length === 0}>Confirm Sale</button>
        {msg ? <p className="admin-muted">{msg}</p> : null}
      </div>

      <div className="admin-card" style={{ padding: 14 }}>
        <h3>My Sales Orders</h3>
        {orders.map((order) => (
          <div key={order.id} className="admin-row" style={{ justifyContent: "space-between" }}>
            <div>#{order.id} {order.customer_name} ({order.customer_email})</div>
            <div>{order.total_jod} JOD {order.status ? `• ${order.status}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
