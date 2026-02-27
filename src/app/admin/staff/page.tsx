import { db, isDbConnectivityError, isDbSchemaError } from "@/lib/db";
import { hasColumn } from "@/lib/dbSchema";
import { ensureIdentityTablesSafe } from "@/lib/identity";
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
  updated_at: string;
};

type SearchParams = {
  saved?: string;
  error?: string;
  q?: string;
};

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  admin: { en: "Admin", ar: "مدير" },
  ops: { en: "Operations", ar: "عمليات" },
  sales: { en: "Sales", ar: "مبيعات" },
};

function savedMessage(saved: string, lang: "en" | "ar"): string {
  if (lang === "ar") {
    if (saved === "created") return "تم إنشاء المستخدم بنجاح.";
    if (saved === "updated") return "تم تحديث المستخدم بنجاح.";
    if (saved === "password") return "تم تحديث كلمة المرور بنجاح.";
    if (saved === "deleted") return "تم حذف المستخدم بنجاح.";
    return "تم حفظ التغييرات.";
  }
  if (saved === "created") return "Staff user created successfully.";
  if (saved === "updated") return "Staff user updated successfully.";
  if (saved === "password") return "Password updated successfully.";
  if (saved === "deleted") return "Staff user deleted successfully.";
  return "Changes saved successfully.";
}

function fmtDate(value: string, lang: "en" | "ar"): string {
  return new Date(value).toLocaleString(lang === "ar" ? "ar-JO" : "en-GB");
}

export default async function AdminStaffPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [lang, resolved] = await Promise.all([getAdminLang(), searchParams]);
  let hasUsername = true;
  let bootstrapError = "";

  try {
    await ensureIdentityTablesSafe();
    hasUsername = await hasColumn("staff_users", "username");
  } catch (error: unknown) {
    bootstrapError = error instanceof Error ? error.message : String(error || "Identity bootstrap failed");
    if (!isDbConnectivityError(error) && !isDbSchemaError(error)) throw error;
  }

  const query = String(resolved?.q || "").trim().toLowerCase();
  const saved = String(resolved?.saved || "").trim();
  const error = String(resolved?.error || "").trim();

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
          th_updated: "آخر تحديث",
          th_actions: "إجراءات",
          inactive: "غير نشط",
          noStaff: "لا يوجد موظفون بعد.",
          search: "بحث",
          searchPlaceholder: "ابحث بالاسم/البريد/الدور",
          resetPassword: "تحديث كلمة المرور",
          update: "تحديث",
          delete: "حذف",
          statsTotal: "إجمالي المستخدمين",
          statsActive: "نشط",
          statsInactive: "غير نشط",
          statsAdmins: "مدراء/عمليات/مبيعات",
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
          th_updated: "Updated",
          th_actions: "Actions",
          inactive: "Inactive",
          noStaff: "No staff users yet.",
          search: "Search",
          searchPlaceholder: "Search by name/email/role",
          resetPassword: "Reset password",
          update: "Update",
          delete: "Delete",
          statsTotal: "Total users",
          statsActive: "Active",
          statsInactive: "Inactive",
          statsAdmins: "Admin/Ops/Sales",
        };

  let rows: StaffRow[] = [];
  if (!bootstrapError) {
    try {
      const res = await db.query<StaffRow>(
        `select id,
                ${hasUsername ? "username" : "email"} as username,
                full_name,
                role,
                is_active,
                created_at::text,
                updated_at::text
           from staff_users
          order by created_at desc
          limit 300`
      );
      rows = res.rows;
    } catch (error: unknown) {
      bootstrapError = error instanceof Error ? error.message : String(error || "Failed to load staff users");
      if (!isDbConnectivityError(error) && !isDbSchemaError(error)) throw error;
    }
  }

  const filtered = rows.filter((row) => {
    if (!query) return true;
    const hay = `${row.username} ${row.full_name || ""} ${row.role}`.toLowerCase();
    return hay.includes(query);
  });

  const stats = {
    total: rows.length,
    active: rows.filter((row) => row.is_active).length,
    inactive: rows.filter((row) => !row.is_active).length,
    admins: rows.filter((row) => {
      const role = String(row.role || "").toLowerCase();
      return role === "admin" || role === "ops" || role === "sales";
    }).length,
  };

  return (
    <div className="admin-grid">
      <div className="admin-card">
        <h1 className="admin-h1">{L.title}</h1>
        <p className="admin-muted">{L.subtitle}</p>
        {saved ? <p style={{ color: "#0f766e", fontWeight: 700 }}>{savedMessage(saved, lang)}</p> : null}
        {error ? <p style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p> : null}
        {bootstrapError ? <p style={{ color: "#8b5e1a", fontWeight: 700 }}>{lang === "ar" ? "تعذر الاتصال بقاعدة البيانات لبعض جداول الموظفين." : "Some staff database tables are unavailable."}</p> : null}
      </div>

      <section className="admin-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="admin-card" style={{ padding: 12 }}><b>{L.statsTotal}</b><div>{stats.total}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{L.statsActive}</b><div>{stats.active}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{L.statsInactive}</b><div>{stats.inactive}</div></div>
        <div className="admin-card" style={{ padding: 12 }}><b>{L.statsAdmins}</b><div>{stats.admins}</div></div>
      </section>

      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>{L.createTitle}</h2>

        <form action="/api/admin/staff" method="post" className="admin-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", alignItems: "end" }}>
          <input type="hidden" name="action" value="create" />

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
            <select className="admin-select" name="role" defaultValue="sales">
              <option value="sales">sales</option>
              <option value="ops">ops</option>
              <option value="admin">admin</option>
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
            <button className="btn btn-primary" style={{ width: "fit-content" }} type="submit">{L.saveStaff}</button>
            <span style={{ fontSize: 13, opacity: 0.75 }}>{L.helper}</span>
          </div>
        </form>
      </section>

      <section className="admin-card admin-grid">
        <h2 style={{ margin: 0 }}>{L.staffList}</h2>

        <form method="get" className="admin-row" style={{ gap: 8 }}>
          <input className="admin-input" name="q" defaultValue={query} placeholder={L.searchPlaceholder} />
          <button className="btn" type="submit">{L.search}</button>
        </form>

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
                <th>{L.th_updated}</th>
                <th>{L.th_actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const roleKey = String(row.role || "sales").toLowerCase();
                const normalizedRole = roleKey === "staff" ? "sales" : roleKey;
                const roleLabel = ROLE_LABELS[normalizedRole] || { en: normalizedRole, ar: normalizedRole };
                const roleText = lang === "ar" ? roleLabel.ar : roleLabel.en;

                return (
                  <tr key={row.id}>
                    <td data-label={L.th_id} className="ltr">{row.id}</td>
                    <td data-label={L.th_name}>{row.full_name || "—"}</td>
                    <td data-label={L.th_email} className="ltr">{row.username}</td>
                    <td data-label={L.th_role}>
                      <b className="ltr">{normalizedRole}</b>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{roleText}</div>
                    </td>
                    <td data-label={L.th_status}>{row.is_active ? L.active : L.inactive}</td>
                    <td data-label={L.th_created} style={{ fontSize: 12, opacity: 0.8 }}>{fmtDate(row.created_at, lang)}</td>
                    <td data-label={L.th_updated} style={{ fontSize: 12, opacity: 0.8 }}>{fmtDate(row.updated_at, lang)}</td>
                    <td data-label={L.th_actions}>
                      <form action="/api/admin/staff" method="post" className="admin-grid" style={{ gap: 6 }}>
                        <input type="hidden" name="action" value="update" />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="email" value={row.username} />
                        <input className="admin-input" name="full_name" defaultValue={row.full_name || ""} placeholder={L.fullName} />
                        <select className="admin-select" name="role" defaultValue={normalizedRole}>
                          <option value="sales">sales</option>
                          <option value="ops">ops</option>
                          <option value="admin">admin</option>
                        </select>
                        <label className="admin-row" style={{ gap: 6 }}>
                          <input type="checkbox" name="is_active" defaultChecked={row.is_active} />
                          <span style={{ fontSize: 12 }}>{L.active}</span>
                        </label>
                        <button className="btn" type="submit">{L.update}</button>
                      </form>

                      <details style={{ marginTop: 8 }}>
                        <summary className="btn" style={{ cursor: "pointer", listStyle: "none" }}>{L.resetPassword}</summary>
                        <form action="/api/admin/staff" method="post" className="admin-grid" style={{ gap: 6, marginTop: 8 }}>
                          <input type="hidden" name="action" value="reset_password" />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="email" value={row.username} />
                          <input type="hidden" name="full_name" value={row.full_name || ""} />
                          <input type="hidden" name="role" value={normalizedRole} />
                          <input type="hidden" name="is_active" value={row.is_active ? "true" : "false"} />
                          <input className="admin-input" type="password" name="password" minLength={8} required placeholder={L.resetPassword} />
                          <button className="btn" type="submit">{L.resetPassword}</button>
                        </form>
                      </details>

                      <form action="/api/admin/staff" method="post" style={{ marginTop: 8 }}>
                        <input type="hidden" name="action" value="delete" />
                        <input type="hidden" name="id" value={row.id} />
                        <button className="btn" type="submit">{L.delete}</button>
                      </form>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 ? (
                <tr>
                  <td data-label={L.th_status} colSpan={8} style={{ padding: 14, opacity: 0.7 }}>{L.noStaff}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
