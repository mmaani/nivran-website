export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const productSlug = "nivran-calm-100ml";
  const fee = 3.5;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
        <h1 style={{ margin: 0 }}>{isAr ? "نيفـران" : "NIVRAN"}</h1>
        <p style={{ marginTop: 6, opacity: 0.75 }}>{isAr ? "ارتدِ الهدوء" : "Wear the calm."}</p>
        <p style={{ marginTop: 10, marginBottom: 0 }}>
          {isAr
            ? "عطر داخلي التصنيع في الأردن — أسلوب نظيف وبسيط، للجنسين، منعش."
            : "In-house made in Jordan — clean minimalist, unisex, fresh."}
        </p>
      </section>

      <section style={{ border: "1px solid #eee", borderRadius: 16, padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>{isAr ? "المنتج" : "Featured product"}</h2>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          {isAr ? "100 مل • 15–18 دينار أردني" : "100ml • 15–18 JOD"}
        </p>
        <p style={{ marginTop: 6, opacity: 0.8 }}>
          {isAr ? `الشحن داخل الأردن: رسوم ثابتة ${fee} د.أ` : `Jordan shipping: flat ${fee} JOD`}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <a
            href={`/${locale}/product/${productSlug}`}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none" }}
          >
            {isAr ? "عرض صفحة المنتج" : "View product"}
          </a>

          <a
            href={`/${locale}/checkout`}
            style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #ddd", textDecoration: "none" }}
          >
            {isAr ? "الانتقال إلى الدفع" : "Go to checkout"}
          </a>
        </div>
      </section>
    </div>
  );
}
