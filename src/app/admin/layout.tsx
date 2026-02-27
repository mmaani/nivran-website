import "./admin.css";
import AdminShell from "./_components/AdminShell";
import { getAdminRole } from "@/lib/admin-page";
import { getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [role, lang] = await Promise.all([getAdminRole(), getAdminLang()]);
  return (
    <AdminShell role={role} initialLang={lang}>
      {children}
    </AdminShell>
  );
}
