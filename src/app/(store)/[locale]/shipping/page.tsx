export default async function ShippingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const lastUpdated = "February 16, 2026";

  type Section = {
    id: string;
    title: string;
    paragraphs: string[];
    bullets?: string[];
  };

  const content: { title: string; intro: string; sections: Section[] } = isAr
    ? {
        title: "سياسة الشحن",
        intro: "تفاصيل نطاق الشحن والرسوم والمدة لطلبات التوصيل داخل الأردن.",
        sections: [
          {
            id: "where",
            title: "نطاق الشحن",
            paragraphs: ["المرحلة ١: التوصيل متاح حاليًا داخل الأردن فقط.", "عند التوسع مستقبلًا سيتم تحديث هذه الصفحة."],
            bullets: ["إذا كان العنوان خارج الأردن فقد لا يتوفر إتمام الطلب."],
          },
          {
            id: "fees",
            title: "رسوم الشحن",
            paragraphs: ["رسوم شحن ثابتة داخل الأردن (تظهر أثناء إتمام الطلب)."],
            bullets: ["الرسوم الحالية: 3.5 دينار أردني داخل الأردن."],
          },
          {
            id: "timing",
            title: "مدة التوصيل",
            paragraphs: ["عادة خلال 1–3 أيام عمل حسب المنطقة والظروف التشغيلية.", "قد تزيد المدة خلال المواسم المزدحمة والعطل."],
            bullets: ["قد يتأخر الشحن إذا احتجنا لتأكيد العنوان أو طلبات الدفع عند الاستلام."],
          },
          {
            id: "cod",
            title: "الدفع عند الاستلام (COD)",
            paragraphs: ["قد يتوفر الدفع عند الاستلام حسب المنطقة وقيمة الطلب.", "قد نتواصل لتأكيد طلبات الدفع عند الاستلام قبل الشحن."],
            bullets: ["يرجى التأكد من إمكانية التواصل مع المستلم عبر الهاتف."],
          },
          {
            id: "attempts",
            title: "محاولات التوصيل وفشل التسليم",
            paragraphs: [
              "إذا فشل التسليم بسبب معلومات غير صحيحة أو عدم توفر المستلم، قد تتم محاولة إعادة التوصيل.",
              "قد تُطبق رسوم إضافية في بعض الحالات.",
            ],
            bullets: ["تحقق من رقم الهاتف والعنوان أثناء إتمام الطلب."],
          },
          {
            id: "issues",
            title: "إن كان هناك مشكلة في الطلب",
            paragraphs: ["إذا بدا الطرد متضررًا، التقط صورًا وتواصل معنا بأسرع وقت.", "في حال وصول منتج تالف/غير مطابق: تواصل خلال 48 ساعة مع صور واضحة."],
            bullets: ["التواصل: hello@nivran.com أو واتساب +962791752686"],
          },
          {
            id: "safety",
            title: "ملاحظة السلامة",
            paragraphs: ["العطور تحتوي على كحول وقابلة للاشتعال—تُستخدم وتُحفظ بعيدًا عن الحرارة واللهب.", "يُحفظ بعيدًا عن متناول الأطفال."],
          },
        ],
      }
    : {
        title: "Shipping Policy",
        intro: "Delivery coverage, fees, and timing for orders within Jordan.",
        sections: [
          {
            id: "where",
            title: "Where we ship",
            paragraphs: ["Phase 1: We currently deliver within Jordan only.", "If we expand in the future, we’ll update this page."],
            bullets: ["If your address is outside Jordan, checkout may not be available."],
          },
          {
            id: "fees",
            title: "Shipping fees",
            paragraphs: ["Shipping is a flat fee across Jordan (shown at checkout)."],
            bullets: ["Current flat fee: 3.5 JOD (Jordan)."],
          },
          {
            id: "timing",
            title: "Delivery times",
            paragraphs: ["Typical delivery is 1–3 business days depending on the area.", "Peak seasons and holidays may add time."],
            bullets: ["If we need to confirm an address or COD order, dispatch may be delayed until confirmation."],
          },
          {
            id: "cod",
            title: "Cash on Delivery (COD)",
            paragraphs: ["COD may be available depending on your location and order value.", "We may contact you to confirm COD orders before dispatch."],
            bullets: ["Please ensure the recipient is reachable by phone."],
          },
          {
            id: "attempts",
            title: "Delivery attempts & failed delivery",
            paragraphs: ["If delivery fails due to incorrect details or unavailability, the carrier may attempt re-delivery.", "Additional fees may apply in some cases."],
            bullets: ["Double-check your phone number and address at checkout."],
          },
          {
            id: "issues",
            title: "If something goes wrong",
            paragraphs: ["If your parcel appears damaged, document it (photos) and contact us as soon as possible.", "For damaged/incorrect items, contact us within 48 hours with clear photos."],
            bullets: ["Contact: hello@nivran.com or WhatsApp +962791752686"],
          },
          {
            id: "safety",
            title: "Safety note",
            paragraphs: ["Perfumes are alcohol-based and flammable. Store and use away from heat and open flames.", "Keep out of reach of children."],
          },
        ],
      };

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <div className="panel" style={{ padding: "1.1rem" }}>
        <p className="muted" style={{ marginTop: 0, marginBottom: ".35rem" }}>
          {isAr ? "NIVRAN / نيفـران" : "NIVRAN"}
        </p>
        <h1 className="title" style={{ marginTop: 0 }}>{content.title}</h1>
        <p className="muted" style={{ marginTop: ".4rem" }}>{content.intro}</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {isAr ? "آخر تحديث: " : "Last updated: "}
          {lastUpdated}
        </p>
      </div>

      <div className="grid-2" style={{ marginTop: "1rem", alignItems: "start" }}>
        <aside className="panel" style={{ position: "sticky", top: 92 }}>
          <h3 style={{ marginTop: 0 }}>{isAr ? "المحتويات" : "Contents"}</h3>
          <ol style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: ".35rem" }}>
            {content.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="muted" style={{ textDecoration: "underline" }}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <main style={{ display: "grid", gap: ".8rem" }}>
          {content.sections.map((s) => (
            <section key={s.id} id={s.id} className="panel" style={{ scrollMarginTop: 96 }}>
              <h2 className="section-title" style={{ marginTop: 0 }}>{s.title}</h2>
              {s.paragraphs.map((p, idx) => (
                <p key={`${s.id}-p-${idx}`} className="muted">{p}</p>
              ))}
              {s.bullets && s.bullets.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 18, display: "grid", gap: ".35rem" }}>
                  {s.bullets.map((b, idx) => (
                    <li key={`${s.id}-b-${idx}`} className="muted">{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
