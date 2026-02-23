export const dynamic = "force-dynamic";

export default function OrderDetailsPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const isAr = params.locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  return (
    <div dir={dir} style={{ padding: "1.2rem 0", maxWidth: 980, margin: "0 auto" }}>
      <div className="panel">
        <h1 className="title" style={{ marginTop: 0 }}>
          {isAr ? "تفاصيل الطلب" : "Order Details"}
        </h1>

        <p className="muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
          {isAr
            ? `صفحة تفاصيل الطلب قيد الإضافة. رقم الطلب: ${params.id}`
            : `Order details page is coming soon. Order ID: ${params.id}`}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
          <a className="btn btn-outline" href={`/${params.locale}/account`}>
            {isAr ? "العودة إلى الحساب" : "Back to account"}
          </a>

          <a className="btn" href={`/${params.locale}/`}>
            {isAr ? "الصفحة الرئيسية" : "Home"}
          </a>
        </div>
      </div>
    </div>
  );
}
