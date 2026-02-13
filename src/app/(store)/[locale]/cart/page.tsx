export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      <a href={`/${locale}`} style={{ textDecoration: "underline" }}>
        {isAr ? "رجوع" : "Back"}
      </a>

      <h1 style={{ marginTop: 14 }}>{isAr ? "السلة" : "Cart"}</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "نسخة MVP: سيتم توصيل السلة لاحقًا. يمكنك المتابعة مباشرة إلى الدفع."
            : "MVP: Cart wiring comes next. You can proceed directly to checkout for now."}
        </p>

        <a href={`/${locale}/checkout`} style={{ textDecoration: "underline" }}>
          {isAr ? "الانتقال إلى الدفع" : "Proceed to Checkout"}
        </a>
      </div>
    </div>
  );
}
