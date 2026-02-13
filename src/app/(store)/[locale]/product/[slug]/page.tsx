export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  // MVP: single product content regardless of slug
  const title = isAr ? "نيفـران — Eau de Parfum (100ml)" : "NIVRAN — Eau de Parfum (100ml)";
  const price = isAr ? "15–18 د.أ" : "15–18 JOD";
  const shippingFee = isAr ? "3.5 د.أ" : "3.5 JOD";

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <a href={`/${locale}`} style={{ textDecoration: "underline" }}>
        {isAr ? "رجوع" : "Back"}
      </a>

      <h1 style={{ marginBottom: 6, marginTop: 14 }}>{title}</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        {isAr ? "ارتدِ الهدوء" : "Wear the calm."}
      </p>

      <div style={{ border: "1px solid #eee", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
          <div><b>{isAr ? "السعر:" : "Price:"}</b> {price}</div>
          <div style={{ opacity: 0.75 }}>|</div>
          <div><b>{isAr ? "الشحن:" : "Shipping:"}</b> {shippingFee}</div>
          <div style={{ opacity: 0.75 }}>|</div>
          <div style={{ fontFamily: "monospace", fontSize: 13, opacity: 0.8 }}>slug: {slug}</div>
        </div>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "القصة" : "Story"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr
              ? "عطر أردني داخلي التصنيع بأسلوب نظيف وبسيط. رائحة منعشة ومحايدة للاستخدام اليومي — بدون أي ادعاءات طبية."
              : "In-house made in Jordan with a clean minimalist point of view. Fresh, unisex daily wear — no medical claims."}
          </p>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "النوتات" : "Notes"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr ? "منعش • نظيف • حمضي/خشبي خفيف (وصف ذوقي)" : "Fresh • Clean • Light citrus/woods (sensory description)"}
          </p>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "الأداء" : "Performance"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr
              ? "الثبات والانتشار يختلفان حسب البشرة والطقس وطريقة الاستخدام."
              : "Longevity and projection vary by skin chemistry, climate, and application."}
          </p>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "المكونات (نهج INCI)" : "Ingredients (INCI approach)"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr
              ? "سيتم عرض قائمة INCI على الملصق/العلبة حسب كل دفعة. هذا وصف عام غير طبي."
              : "INCI list appears on label/box per batch. This is general non-medical information."}
          </p>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "الاستخدام والتحذيرات" : "Usage & warnings"}</h3>
          <ul style={{ marginTop: 0 }}>
            <li>{isAr ? "قابل للاشتعال — يُحفظ بعيدًا عن الحرارة واللهب." : "Flammable — keep away from heat and flame."}</li>
            <li>{isAr ? "للاستخدام الخارجي فقط. تجنب العينين." : "For external use only. Avoid eyes."}</li>
            <li>{isAr ? "أوقف الاستخدام إذا حدث تهيّج." : "Stop use if irritation occurs."}</li>
          </ul>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "معلومات الدفعة/الصلاحية" : "Batch/expiry info"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr
              ? "رقم الدفعة وتاريخ الصلاحية (إن وجد) يكونان على العبوة. احتفظ بالعبوة للرجوع إليها."
              : "Batch number and expiry (if applicable) are printed on packaging. Keep the box for reference."}
          </p>
        </section>

        <section>
          <h3 style={{ marginBottom: 6 }}>{isAr ? "الشحن والإرجاع" : "Shipping & returns"}</h3>
          <p style={{ marginTop: 0 }}>
            {isAr
              ? "شحن داخل الأردن فقط. الإرجاع للمنتجات غير المفتوحة فقط. التفاصيل في صفحات السياسات."
              : "Jordan only. Returns accepted only for unopened items. See policy pages for details."}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={`/${locale}/checkout`} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none" }}>
              {isAr ? "اشترِ الآن" : "Buy now"}
            </a>
            <a href={`/${locale}/returns`} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none" }}>
              {isAr ? "سياسة الإرجاع" : "Returns policy"}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
