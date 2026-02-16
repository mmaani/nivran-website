import "./admin.css";
import AdminShell from "./_components/AdminShell";
import { isAdminAuthed } from "@/lib/admin-page";
import { getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, lang] = await Promise.all([isAdminAuthed(), getAdminLang()]);
  return (
    <AdminShell authed={authed} initialLang={lang}>
      {children}
    </AdminShell>
  );
}
