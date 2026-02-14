import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  price_jod: string;
  compare_at_price_jod: string | null;
  inventory_qty: number;
  is_active: boolean;
};

type PromoRow = {
  id: number;
  code: string;
  title_en: string;
  title_ar: string;
  discount_type: "PERCENT" | "FIXED";
  discount_value: string;
  is_active: boolean;
};

export default async function AdminCatalogPage() {
  await ensureCatalogTables();

  const [productsRes, promosRes] = await Promise.all([
    db.query<ProductRow>(`select id, slug, name_en, name_ar, price_jod::text, compare_at_price_jod::text, inventory_qty, is_active from products order by created_at desc limit 200`),
    db.query<PromoRow>(`select id, code, title_en, title_ar, discount_type, discount_value::text, is_active from promotions order by created_at desc limit 200`),
  ]);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1200, margin: "20px auto", padding: 16, display: "grid", gap: 16 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}><h1 style={{ margin: 0 }}>NIVRAN Admin — CRM & Catalog</h1><a href="/admin/orders" style={{ textDecoration:"underline" }}>Orders</a><a href="/admin/inbox" style={{ textDecoration:"underline" }}>Inbox</a><a href="/admin/staff" style={{ textDecoration:"underline" }}>Staff</a></div>
      <p style={{ opacity: 0.75, margin: 0 }}>Manage products, inventory, prices, discounts, and promotions in one place.</p>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Add / Update Product</h2>
        <form action="/api/admin/catalog/products" method="post" style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="slug" required placeholder="slug (e.g. nivran-calm-100ml)" />
            <input name="price_jod" type="number" step="0.01" min="0" required placeholder="price (JOD)" />
            <input name="name_en" required placeholder="English name" />
            <input name="name_ar" required placeholder="Arabic name" />
            <input name="compare_at_price_jod" type="number" step="0.01" min="0" placeholder="compare at price (optional)" />
            <input name="inventory_qty" type="number" min="0" defaultValue="0" required placeholder="inventory qty" />
            <input name="description_en" placeholder="English description" />
            <input name="description_ar" placeholder="Arabic description" />
          </div>
          <label><input type="checkbox" name="is_active" defaultChecked /> Active</label>
          <button style={{ width: "fit-content" }}>Save product</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Products & Inventory</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th>Slug</th><th>Name</th><th>Price</th><th>Inventory</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {productsRes.rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                  <td>{p.slug}</td>
                  <td>{p.name_en}<br />{p.name_ar}</td>
                  <td>{p.price_jod} JOD {p.compare_at_price_jod ? `(was ${p.compare_at_price_jod})` : ""}</td>
                  <td>{p.inventory_qty}</td>
                  <td>{p.is_active ? "Active" : "Hidden"}</td>
                  <td>
                    <form action="/api/admin/catalog/products" method="post" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <input type="hidden" name="action" value="update" />
                      <input type="hidden" name="id" value={p.id} />
                      <input name="price_jod" type="number" step="0.01" defaultValue={p.price_jod} style={{ width: 90 }} />
                      <input name="compare_at_price_jod" type="number" step="0.01" defaultValue={p.compare_at_price_jod || ""} placeholder="compare" style={{ width: 90 }} />
                      <input name="inventory_qty" type="number" min="0" defaultValue={p.inventory_qty} style={{ width: 85 }} />
                      <label><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> active</label>
                      <button>Update</button>
                    </form>
                    <form action="/api/admin/catalog/products" method="post">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={p.id} />
                      <button style={{ marginTop: 6 }}>Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Add Promotion</h2>
        <form action="/api/admin/catalog/promotions" method="post" style={{ display: "grid", gap: 8 }}>
          <input type="hidden" name="action" value="create" />
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <input name="code" required placeholder="Promo code (e.g. RAMADAN10)" />
            <select name="discount_type" defaultValue="PERCENT"><option value="PERCENT">Percent %</option><option value="FIXED">Fixed JOD</option></select>
            <input name="discount_value" type="number" min="0" step="0.01" required placeholder="Discount value" />
            <input name="usage_limit" type="number" min="1" placeholder="Usage limit (optional)" />
            <input name="title_en" required placeholder="Title EN" />
            <input name="title_ar" required placeholder="Title AR" />
            <input name="starts_at" type="datetime-local" />
            <input name="ends_at" type="datetime-local" />
          </div>
          <label><input type="checkbox" name="is_active" defaultChecked /> Active</label>
          <button style={{ width: "fit-content" }}>Save promotion</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <h2 style={{ marginTop: 0 }}>Promotions</h2>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {promosRes.rows.map((r) => (
            <li key={r.id}>
              <strong>{r.code}</strong> — {r.discount_type === "PERCENT" ? `${r.discount_value}%` : `${r.discount_value} JOD`} — {r.title_en} / {r.title_ar} ({r.is_active ? "Active" : "Inactive"})
              <form action="/api/admin/catalog/promotions" method="post" style={{ display: "inline-flex", gap: 8, marginInlineStart: 10 }}>
                <input type="hidden" name="action" value="toggle" />
                <input type="hidden" name="id" value={r.id} />
                <label><input type="checkbox" name="is_active" defaultChecked={r.is_active} /> active</label>
                <button>Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
