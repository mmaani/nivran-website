export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>{isAr ? "سياسة الاستبدال/الاسترجاع" : "Returns & Exchanges"}</h1>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "لأسباب تتعلق بالسلامة والنظافة، نقبل الإرجاع فقط للمنتجات غير المفتوحة وفي حالتها الأصلية."
            : "For safety and hygiene, returns are accepted only for unopened items in original condition."}
        </p>
        <ul>
          <li>{isAr ? "في حال وصول المنتج تالفًا: تواصل معنا خلال 48 ساعة مع صور واضحة." : "If damaged on arrival: contact us within 48 hours with clear photos."}</li>
          <li>{isAr ? "لن نقبل إرجاع العطور المفتوحة أو المستخدمة." : "Opened/used perfumes are not returnable."}</li>
          <li>{isAr ? "قد يتم استبدال المنتج أو إصدار رصيد/استرجاع حسب الحالة." : "We may replace, issue store credit, or refund depending on case."}</li>
        </ul>
      </div>
    </div>
  );
}
