export default async function CompliancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>{isAr ? "تنبيهات والالتزام" : "Compliance & Disclaimers"}</h1>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <ul style={{ marginTop: 0 }}>
          <li>{isAr ? "صياغة آمنة للادعاءات: بدون ادعاءات طبية/علاجية." : "Claim-safe wording: no medical/therapeutic claims."}</li>
          <li>{isAr ? "قابل للاشتعال: يُحفظ بعيدًا عن الحرارة واللهب." : "Flammable: keep away from heat and flame."}</li>
          <li>{isAr ? "للاستخدام الخارجي فقط. تجنب العينين." : "For external use only. Avoid eyes."}</li>
          <li>{isAr ? "حساسية الجلد: اختبر على منطقة صغيرة إذا لزم." : "Skin sensitivity: patch test if needed."}</li>
        </ul>
      </div>
    </div>
  );
}
