import { db } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureIdentityTables } from "@/lib/identity";
import { getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaffRow = {
  id: number;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  admin: { en: "Admin", ar: "مدير" },
  ops: { en: "Operations", ar: "عمليات" },
  staff: { en: "Staff", ar: "موظف" },
};

export default async function AdminStaffPage() {
  await ensureIdentityTables();
  const lang = await getAdminLang();
  const hasUsername = await hasColumn("staff_users", "username");

  const L =
    lang === "ar"
      ? {
          title: "إدارة الموظفين",
          subtitle: "إنشاء وإدارة حسابات الموظفين/المشغلين لفريق العمل.",
          createTitle: "إنشاء مستخدم موظف",
          staffList: "قائمة الموظفين",
          fullName: "الاسم الكامل",
          email: "البريد الإلكتروني",
          role: "الدور",
          password: "كلمة مرور مؤقتة",
          active: "نشط",
          saveStaff: "حفظ الموظف",
          helper: "استخدم كلمة مرور مؤقتة واطلب من الموظف تغييرها.",
          th_id: "المعرّف",
          th_name: "الاسم",
          th_email: "البريد",
          th_role: "الدور",
          th_status: "الحالة",
          th_created: "تاريخ الإنشاء",
          inactive: "غير نشط",
          noStaff: "لا يوجد موظفون بعد.",
        }
      : {
          title: "Staff Management",
          subtitle: "Create and manage staff/operator accounts used by your team.",
          createTitle: "Create staff user",
          staffList: "Staff list",
          fullName: "Full name",
          email: "Email",
          role: "Role",
          password: "Temporary password",
          active: "Active",
          saveStaff: "Save staff",
          helper: "Use a temporary password and ask the staff member to change it.",
          th_id: "ID",
          th_name: "Name",
          th_email: "Email",
          th_role: "Role",
          th_status: "Status",
          th_created: "Created",
          inactive: "Inactive",
          noStaff: "No staff users yet.",
        };

  const { rows } = await db.query<StaffRow>(
    `select id, ${hasUsername ? "username" : "email"} as username, full_name, role, is_active, created_at::text
     from staff_users
     order by created_at desc
     limit 200`
  );

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">{L.title}</h1>
        <p className="admin-muted">{L.subtitle}</p>
      </div>

      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>{L.createTitle}</h2>

        <form
          action="/api/admin/staff"
          method="post"
          className="admin-grid"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", alignItems: "end" }}
        >
          <div className="admin-grid" style={{ gap: 8 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>{L.fullName}</label>
            <input className="admin-input" name="full_name" placeholder={L.fullName} />
          </div>

          <div className="admin-grid" style={{ gap: 8 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>{L.email}</label>
            <input className="admin-input ltr" name="email" type="email" required placeholder="staff@email.com" />
          </div>

          <div className="admin-grid" style={{ gap: 8 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>{L.role}</label>
            <select className="admin-select" name="role" defaultValue="staff">
              <option value="staff">{lang === "ar" ? "staff — موظف" : "staff — Staff"}</option>
              <option value="ops">{lang === "ar" ? "ops — عمليات" : "ops — Operations"}</option>
              <option value="admin">{lang === "ar" ? "admin — مدير" : "admin — Admin"}</option>
            </select>
          </div>

          <div className="admin-grid" style={{ gap: 8 }}>
            <label style={{ fontSize: 13, opacity: 0.8 }}>{L.password}</label>
            <input className="admin-input" name="password" type="password" required minLength={8} placeholder={L.password} />
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", gridColumn: "1 / -1" }}>
            <input name="is_active" type="checkbox" defaultChecked />
            <span>{L.active}</span>
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", gridColumn: "1 / -1" }}>
            <button className="btn btn-primary" style={{ width: "fit-content" }} type="submit">
              {L.saveStaff}
            </button>
            <span style={{ fontSize: 13, opacity: 0.75 }}>{L.helper}</span>
          </div>
        </form>
      </section>

      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>{L.staffList}</h2>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{L.th_id}</th>
                <th>{L.th_name}</th>
                <th>{L.th_email}</th>
                <th>{L.th_role}</th>
                <th>{L.th_status}</th>
                <th>{L.th_created}</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const roleKey = String(r.role || "staff").toLowerCase();
                const roleLabel = ROLE_LABELS[roleKey] || { en: roleKey, ar: roleKey };
                const roleText = lang === "ar" ? roleLabel.ar : roleLabel.en;

                return (
                  <tr key={r.id}>
                    <td className="ltr">{r.id}</td>
                    <td>{r.full_name || "—"}</td>
                    <td className="ltr">{r.username}</td>
                    <td>
                      <b className="ltr">{roleKey}</b>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{roleText}</div>
                    </td>
                    <td>{r.is_active ? L.active : L.inactive}</td>
                    <td style={{ fontSize: 12, opacity: 0.8 }}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.7 }}>
                    {L.noStaff}
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
