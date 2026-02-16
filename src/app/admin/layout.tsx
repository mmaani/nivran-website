import "./admin.css";
import AdminShell from "./_components/AdminShell";
import { isAdminAuthed } from "@/lib/admin-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();
  return <AdminShell authed={authed}>{children}</AdminShell>;
}
