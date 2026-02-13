import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactRow = { id: number; name: string; email: string; phone: string | null; message: string; locale: string; created_at: string };
type SubscriberRow = { id: number; email: string; locale: string; created_at: string };

export default async function AdminInboxPage() {
  const [contact, subs] = await Promise.all([
    db.query<ContactRow>(`select id, name, email, phone, message, locale, created_at from contact_submissions order by created_at desc limit 100`),
    db.query<SubscriberRow>(`select id, email, locale, created_at from newsletter_subscribers order by created_at desc limit 100`),
  ]);

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1120, margin: "20px auto", padding: 16 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}><h1 style={{ margin:0 }}>NIVRAN Admin — Inbox</h1><a href="/admin/orders" style={{ textDecoration:"underline" }}>Orders</a><a href="/admin/catalog" style={{ textDecoration:"underline" }}>Catalog</a><a href="/admin/staff" style={{ textDecoration:"underline" }}>Staff</a></div>
      <h2>Contact submissions</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
          {contact.rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}><strong>{r.name}</strong><br />{r.email}<br />{r.phone || "-"}</td>
              <td style={{ padding: 8 }}>{r.message}</td>
              <td style={{ padding: 8 }}>{r.locale}<br />{new Date(r.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody></table>
      </div>

      <h2>Newsletter subscribers</h2>
      <ul>{subs.rows.map((s) => <li key={s.id}>{s.email} ({s.locale})</li>)}</ul>
    </div>
  );
}
