import SalesClient from "./sales-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SalesPage() {
  return <SalesClient />;
}
