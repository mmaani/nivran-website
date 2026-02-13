export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>{isAr ? "الشروط والأحكام" : "Terms & Conditions"}</h1>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <ul style={{ marginTop: 0 }}>
          <li>{isAr ? "الأسعار بالـ JOD وقد تتغير دون إشعار." : "Prices are in JOD and may change without notice."}</li>
          <li>{isAr ? "نحتفظ بحق إلغاء الطلبات المشتبه بها." : "We may cancel suspected fraudulent orders."}</li>
          <li>{isAr ? "الوصف والصور لأغراض العرض وقد تختلف بشكل بسيط." : "Descriptions/images are illustrative; minor variations may occur."}</li>
          <li>{isAr ? "لا نقدم ادعاءات طبية أو علاجية عن المنتج." : "No medical/therapeutic claims are made about the product."}</li>
        </ul>
      </div>
    </div>
  );
}
