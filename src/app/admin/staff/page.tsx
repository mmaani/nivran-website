import { db } from "@/lib/db";
import { ensureIdentityTables } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaffRow = {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export default async function AdminStaffPage() {
  await ensureIdentityTables();
  const { rows } = await db.query<StaffRow>(
    `select id, email, full_name, role, is_active, created_at::text
     from staff_users
     order by created_at desc
     limit 200`
  );

  return (
    <div style={{ fontFamily: "system-ui", maxWidth: 1100, margin: "20px auto", padding: 16 }}>
      <h1>NIVRAN Admin — Staff Management</h1>
      <p style={{ opacity: 0.75 }}>Create and manage staff/operator accounts used by your team.</p>

      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        <h2 style={{ marginTop: 0 }}>Create staff user</h2>
        <form action="/api/admin/staff" method="post" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
          <input name="full_name" placeholder="Full name" />
          <input name="email" type="email" required placeholder="staff@email.com" />
          <input name="role" defaultValue="staff" placeholder="Role (staff/admin/ops)" />
          <input name="password" type="password" required minLength={8} placeholder="Temporary password" />
          <label><input name="is_active" type="checkbox" defaultChecked /> Active</label>
          <button style={{ width: "fit-content" }}>Save staff</button>
        </form>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Staff list</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td>{r.id}</td>
                  <td>{r.full_name || "-"}</td>
                  <td>{r.email}</td>
                  <td>{r.role}</td>
                  <td>{r.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
