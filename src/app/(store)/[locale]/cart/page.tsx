import { Suspense } from "react";
import CartClient from "./CartClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";

  return (
    <Suspense fallback={<div style={{ padding: "1.2rem 0" }} className="muted">Loading...</div>}>
      <CartClient locale={locale} />
    </Suspense>
  );
}
