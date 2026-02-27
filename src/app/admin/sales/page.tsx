import SalesClient from "./sales-client";
import { getAdminLang } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const lang = await getAdminLang();
  return <SalesClient initialLang={lang} />;
}
