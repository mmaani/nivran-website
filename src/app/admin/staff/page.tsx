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

function T({ en, ar }: { en: string; ar: string }) {
  return (
    <>
      <span className="t-en">{en}</span>
      <span className="t-ar">{ar}</span>
    </>
  );
}

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  admin: { en: "Admin", ar: "مدير" },
  ops: { en: "Operations", ar: "عمليات" },
  staff: { en: "Staff", ar: "موظف" },
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
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">
          <T en="Staff Management" ar="إدارة الموظفين" />
        </h1>
        <p className="admin-muted">
          <T
            en="Create and manage staff/operator accounts used by your team."
            ar="إنشاء وإدارة حسابات الموظفين/المشغلين لفريق العمل."
          />
        </p>
      </div>

      {/* Create staff */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Create staff user" ar="إنشاء مستخدم موظف" />
        </h2>

        <form
          action="/api/admin/staff"
          method="post"
          className="admin-grid"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" as any }}
        >
          <input className="admin-input" name="full_name" placeholder="Full name / الاسم الكامل" />
          <input className="admin-input" name="email" type="email" required placeholder="staff@email.com" />

          <select className="admin-select" name="role" defaultValue="staff">
            <option value="staff">
              staff — {ROLE_LABELS.staff.en} / {ROLE_LABELS.staff.ar}
            </option>
            <option value="ops">
              ops — {ROLE_LABELS.ops.en} / {ROLE_LABELS.ops.ar}
            </option>
            <option value="admin">
              admin — {ROLE_LABELS.admin.en} / {ROLE_LABELS.admin.ar}
            </option>
          </select>

          <input
            className="admin-input"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Temporary password / كلمة مرور مؤقتة"
          />

          <label className="admin-row" style={{ gap: 8 }}>
            <input name="is_active" type="checkbox" defaultChecked />
            <span>
              <T en="Active" ar="نشط" />
            </span>
          </label>

          <div className="admin-row" style={{ gridColumn: "1 / -1" }}>
            <button className="btn btn-primary" style={{ width: "fit-content" }} type="submit">
              <T en="Save staff" ar="حفظ الموظف" />
            </button>
            <span className="admin-label">
              <T
                en="Use a temporary password and ask the staff member to change it."
                ar="استخدم كلمة مرور مؤقتة واطلب من الموظف تغييرها."
              />
            </span>
          </div>
        </form>
      </section>

      {/* Staff list */}
      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>
          <T en="Staff list" ar="قائمة الموظفين" />
        </h2>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <T en="ID" ar="المعرف" />
                </th>
                <th>
                  <T en="Name" ar="الاسم" />
                </th>
                <th>
                  <T en="Email" ar="البريد" />
                </th>
                <th>
                  <T en="Role" ar="الدور" />
                </th>
                <th>
                  <T en="Status" ar="الحالة" />
                </th>
                <th>
                  <T en="Created" ar="تاريخ الإنشاء" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const role = (r.role || "staff").toLowerCase();
                const roleLabel = ROLE_LABELS[role] || { en: role, ar: role };
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.full_name || "—"}</td>
                    <td className="mono">{r.email}</td>
                    <td>
                      <b className="mono">{role}</b>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                        <span className="t-en">{roleLabel.en}</span>
                        <span className="t-ar">{roleLabel.ar}</span>
                      </div>
                    </td>
                    <td>{r.is_active ? <T en="Active" ar="نشط" /> : <T en="Inactive" ar="غير نشط" />}</td>
                    <td style={{ fontSize: 12, opacity: 0.8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                    <T en="No staff users yet." ar="لا يوجد موظفون بعد." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
