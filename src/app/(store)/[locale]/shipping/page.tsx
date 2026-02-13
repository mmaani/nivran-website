export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";
  const fee = 3.5;

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>{isAr ? "سياسة الشحن" : "Shipping Policy"}</h1>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr ? `الشحن داخل الأردن فقط (المرحلة ١). رسوم ثابتة: ${fee} دينار أردني.` : `Jordan only (Phase 1). Flat shipping fee: ${fee} JOD.`}
        </p>
        <ul>
          <li>{isAr ? "مدة التوصيل تختلف حسب المدينة." : "Delivery time varies by city."}</li>
          <li>{isAr ? "سيتم التواصل لتأكيد الطلب قبل الشحن في حالة الدفع عند الاستلام." : "For COD, we confirm before shipping."}</li>
          <li>{isAr ? "العطور الكحولية قابلة للاشتعال — يُحفظ بعيداً عن الحرارة واللهب." : "Alcohol-based perfumes are flammable — keep away from heat and flame."}</li>
        </ul>
      </div>
    </div>
  );
}
