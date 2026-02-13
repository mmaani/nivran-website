export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ maxWidth: 860 }}>
      <h1>{isAr ? "سياسة الخصوصية" : "Privacy Policy"}</h1>
      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "نستخدم بياناتك فقط لمعالجة الطلبات وخدمة العملاء وتحسين تجربة المتجر."
            : "We use your data to process orders, provide support, and improve the store experience."}
        </p>
        <ul>
          <li>{isAr ? "بيانات الطلب: الاسم، الهاتف، العنوان، وتفاصيل الشحن." : "Order data: name, phone, address, shipping details."}</li>
          <li>{isAr ? "لا نبيع بياناتك لأطراف ثالثة." : "We do not sell your data."}</li>
          <li>{isAr ? "الدفع عبر PayTabs يتم على صفحة دفع مستضافة." : "Card payments via PayTabs happen on a hosted payment page."}</li>
        </ul>
      </div>
    </div>
  );
}
