import RequireAdmin from "@/app/admin/_components/RequireAdmin";
import InventoryClient from "./ui";
import { getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InventoryReconPage() {
  const lang = await getAdminLang();
  return (
    <RequireAdmin>
      <InventoryClient lang={lang} />
    </RequireAdmin>
  );
}
