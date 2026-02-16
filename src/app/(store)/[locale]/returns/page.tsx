export default async function ReturnsPage({
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
        title: "سياسة الاستبدال/الاسترجاع",
        intro: "كيف نتعامل مع الاستبدال والاسترجاع والاسترجاع المالي لطلبات منتجات نيفـران.",
        sections: [
          {
            id: "hygiene",
            title: "سياسة السلامة والنظافة (مهم)",
            paragraphs: [
              "حرصًا على السلامة والنظافة، العطور ومنتجات العناية الشخصية/التجميلية المفتوحة أو المستخدمة غالبًا لا تُسترجع.",
              "في حال قبول الاسترجاع، يجب أن يكون المنتج غير مفتوح وغير مستخدم وبحالته الأصلية (بما في ذلك التغليف).",
            ],
            bullets: ["لا تفتح المنتج إذا كنت تنوي طلب الاسترجاع."],
          },
          {
            id: "when",
            title: "متى يمكننا مساعدتك",
            paragraphs: [
              "إذا وصل الطلب تالفًا أو غير مطابق أو ناقصًا، تواصل معنا خلال 48 ساعة من الاستلام مع صور واضحة.",
              "سنراجع الحالة ونقترح الحل الأنسب (استبدال/رصيد/استرجاع) حسب الحالة.",
              "تُطبق هذه السياسة على منتجات نيفـران بما يشمل العطور ومنتجات العناية الشخصية المشابهة مثل الكريمات والصابون.",
            ],
            bullets: ["البريد: hello@nivran.com", "واتساب: +962791752686"],
          },
          {
            id: "process",
            title: "إجراءات الاسترجاع",
            paragraphs: [
              "تواصل مع الدعم وأرفق رقم الطلب (إن وجد) وتفاصيل المشكلة وصورًا واضحة.",
              "إذا تمت الموافقة، سنرسل لك التعليمات اللازمة للاستبدال أو الاسترجاع.",
            ],
            bullets: ["احتفظ بالصندوق والتغليف الأصلي حتى اكتمال معالجة الطلب."],
          },
          {
            id: "refunds",
            title: "الاسترجاع المالي",
            paragraphs: [
              "إذا تمت الموافقة على استرجاع مالي، سيتم الإرجاع لنفس وسيلة الدفع بعد التحقق/المعاينة.",
              "قد تختلف مدة وصول المبلغ حسب مزود الدفع والبنك.",
            ],
            bullets: [
              "رسوم الشحن عادة غير قابلة للاسترجاع إلا إذا كان الخطأ من طرفنا، بما لا يتعارض مع القوانين المعمول بها.",
            ],
          },
        ],
      }
    : {
        title: "Returns & Exchanges",
        intro: "How returns, exchanges, and refunds work for NIVRAN product orders.",
        sections: [
          {
            id: "hygiene",
            title: "Hygiene-first policy (important)",
            paragraphs: [
              "For safety and hygiene, opened or used perfumes and personal care/cosmetic items are typically not returnable.",
              "If a return is accepted, items must be unopened, unused, and in original condition (including all packaging).",
            ],
            bullets: ["Do not open the product if you plan to request a return."],
          },
          {
            id: "when",
            title: "When we can help",
            paragraphs: [
              "If your order arrives damaged, defective, missing items, or incorrect, contact us within 48 hours of delivery with clear photos.",
              "We will review and propose the appropriate resolution (replacement, store credit, or refund) depending on the case.",
              "This policy applies across NIVRAN products, including perfumes and similar personal care items such as creams and soaps.",
            ],
            bullets: ["Email: hello@nivran.com", "WhatsApp: +962791752686"],
          },
          {
            id: "process",
            title: "Return process",
            paragraphs: ["Contact support and include your order number (if available), the issue, and photos.", "If approved, we will provide instructions for return or replacement."],
            bullets: ["Keep the original box and packaging until your request is resolved."],
          },
          {
            id: "refunds",
            title: "Refunds",
            paragraphs: ["If a refund is approved, it will be issued to the original payment method after verification.", "Refund timing depends on the payment provider and your bank."],
            bullets: ["Shipping fees are typically non-refundable unless the issue was caused by an error on our side, subject to applicable law."],
          },
        ],
      };

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <div className="panel" style={{ padding: "1.1rem" }}>
        <p className="muted" style={{ marginTop: 0, marginBottom: ".35rem" }}>
          {isAr ? "NIVRAN / نيفـران" : "NIVRAN"}
        </p>
        <p className="muted" style={{ marginTop: 0, marginBottom: ".5rem", fontSize: 13 }}>
          {isAr ? "الكيان القانوني: Nivran Fragrance" : "Legal entity: Nivran Fragrance"}
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

          <div style={{ borderTop: "1px solid rgba(0,0,0,.08)", marginTop: ".9rem", paddingTop: ".9rem" }}>
            <p className="muted" style={{ marginTop: 0, marginBottom: ".5rem" }}>
              {isAr ? "تواصل معنا" : "Contact us"}
            </p>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <a className="btn" href="mailto:hello@nivran.com">{isAr ? "البريد" : "Email"}</a>
              <a className="btn" href="https://wa.me/962791752686" target="_blank" rel="noreferrer">
                {isAr ? "واتساب" : "WhatsApp"}
              </a>
            </div>
          </div>
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
