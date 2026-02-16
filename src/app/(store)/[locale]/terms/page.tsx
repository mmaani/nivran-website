export default async function TermsPage({
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
        title: "الشروط والأحكام",
        intro: "قواعد واضحة لاستخدام متجر نيفـران وإتمام الطلبات.",
        sections: [
          {
            id: "overview",
            title: "نظرة عامة",
            paragraphs: [
              "تُنظّم هذه الشروط استخدامك لمتجر نيفـران الإلكتروني وأي عملية شراء تتم من خلاله.",
              "بإتمام الطلب، فإنك تؤكد أنك قرأت هذه الشروط ووافقت عليها.",
            ],
            bullets: [
              "العلامة: نيفـران (NIVRAN) – الأردن.",
              "القناة: طلبات إلكترونية للتوصيل داخل الأردن (المرحلة ١).",
            ],
          },
          {
            id: "eligibility",
            title: "الأهلية والحسابات",
            paragraphs: [
              "يجب أن تكون قادرًا قانونيًا على إبرام عقد ملزم وفق القوانين المعمول بها.",
              "أنت مسؤول عن إدخال بيانات الاتصال والتوصيل بشكل صحيح ومحدّث.",
            ],
            bullets: [
              "قد نرفض الخدمة أو نلغي الطلبات إذا كانت البيانات غير دقيقة أو تبدو احتيالية.",
              "إذا أنشأت حسابًا، احرص على حماية بيانات الدخول.",
            ],
          },
          {
            id: "products",
            title: "المنتجات ووصف النفحات",
            paragraphs: [
              "نقدّم الوصف والنفحات والصور لمساعدتك على الاختيار—وقد تظهر فروقات بسيطة بسبب اختلاف الدُفعات أو الإضاءة أو إعدادات الشاشة.",
              "عطور نيفـران منتجات تجميلية مخصّصة للرائحة فقط ولا نقدم ادعاءات طبية أو علاجية.",
            ],
            bullets: [
              "إن كانت بشرتك حساسة، يُفضّل اختبار المنتج على مساحة صغيرة أولًا وإيقاف الاستخدام عند حدوث تهيّج.",
              "يُحفظ بعيدًا عن الحرارة واللهب وبعيدًا عن متناول الأطفال.",
            ],
          },
          {
            id: "pricing",
            title: "الأسعار والضرائب والعروض",
            paragraphs: [
              "جميع الأسعار بالـ JOD. قد تتغير الأسعار أو التوفر في أي وقت.",
              "العروض الترويجية خاضعة للتوفر وقد يتم تعديلها أو إيقافها دون إشعار مسبق ما لم يمنع القانون ذلك.",
            ],
            bullets: [
              "تظهر رسوم الشحن (إن وجدت) أثناء إتمام الطلب.",
              "أكواد الخصم تُطبق وفق شروطها ولا تُجمع إلا إذا تم ذكر ذلك صراحة.",
            ],
          },
          {
            id: "orders",
            title: "الطلبات والدفع والتأكيد",
            paragraphs: [
              "يُعتبر الطلب مقبولًا عند تأكيده من طرفنا (بريد/واتساب/رسالة) أو عند شحنه.",
              "يتم الدفع الإلكتروني عبر PayTabs. وقد يتوفر الدفع عند الاستلام حسب المنطقة.",
            ],
            bullets: [
              "قد نتواصل لتأكيد طلبات الدفع عند الاستلام قبل الشحن.",
              "في حال فشل الدفع أو عكسه، قد يتم إلغاء الطلب.",
            ],
          },
          {
            id: "delivery",
            title: "التوصيل",
            paragraphs: [
              "مواعيد التوصيل المذكورة تقديرية وقد تختلف حسب المنطقة والعطل والظروف التشغيلية.",
              "تنتقل مسؤولية/مخاطر التسليم إليك عند التوصيل للعنوان المُدخل.",
            ],
            bullets: [
              "يرجى التأكد من وجود شخص لاستلام الطلب.",
              "قد تُطبق رسوم إعادة التوصيل إذا فشل التسليم بسبب معلومات غير صحيحة.",
            ],
          },
          {
            id: "returns",
            title: "الاستبدال/الاسترجاع",
            paragraphs: [
              "لأسباب تتعلق بالسلامة والنظافة، العطور المفتوحة أو المستخدمة غالبًا لا تُسترجع.",
              "إذا وصل المنتج تالفًا أو غير مطابق، تواصل معنا خلال 48 ساعة مع صور واضحة لنعالج الحالة.",
            ],
            bullets: [
              "الاسترجاع المقبول يجب أن يكون غير مفتوح وغير مستخدم وبحالته الأصلية.",
              "يتم الاسترجاع (عند انطباق الشروط) لنفس وسيلة الدفع بعد التحقق.",
            ],
          },
          {
            id: "ip",
            title: "الملكية الفكرية",
            paragraphs: [
              "كافة محتويات الموقع (نصوص، صور، علامات، تصاميم) مملوكة لنيفـران أو مرخّصة لها.",
              "لا يجوز النسخ أو إعادة الاستخدام دون إذن كتابي.",
            ],
            bullets: ["يسمح بمشاركة روابط المنتجات للاستخدام الشخصي."],
          },
          {
            id: "liability",
            title: "حدود المسؤولية",
            paragraphs: [
              "إلى الحد الذي يسمح به القانون، لا تتحمل نيفـران مسؤولية الأضرار غير المباشرة أو التبعية الناتجة عن استخدام الموقع أو المنتجات.",
              "لا شيء في هذه الشروط يحد من المسؤولية إذا كان القانون يمنع ذلك.",
            ],
            bullets: ["اتبع تعليمات الاستخدام والسلامة على العبوة دائمًا."],
          },
          {
            id: "law",
            title: "القانون المختص وتسوية النزاعات",
            paragraphs: [
              "تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية.",
              "في حال حدوث نزاع، نفضّل التواصل معنا أولًا لمحاولة حلّه وديًا.",
            ],
            bullets: ["التواصل: hello@nivran.com"],
          },
          {
            id: "changes",
            title: "تعديل الشروط",
            paragraphs: [
              "قد نقوم بتحديث هذه الشروط من وقت لآخر. سيتم نشر النسخة المحدثة في هذه الصفحة مع تعديل تاريخ \"آخر تحديث\".",
            ],
          },
        ],
      }
    : {
        title: "Terms & Conditions",
        intro: "Clear rules for using the NIVRAN store and placing orders.",
        sections: [
          {
            id: "overview",
            title: "Overview",
            paragraphs: [
              "These Terms govern your use of the NIVRAN online store and any purchase made through it.",
              "By placing an order, you confirm you have read and accepted these Terms.",
            ],
            bullets: ["Brand: NIVRAN (Jordan).", "Channel: Online orders for delivery within Jordan (Phase 1)."],
          },
          {
            id: "eligibility",
            title: "Eligibility & accounts",
            paragraphs: [
              "You must be able to enter into a binding agreement under applicable law.",
              "You are responsible for providing accurate contact and delivery information.",
            ],
            bullets: [
              "We may refuse service or cancel orders if information appears inaccurate or fraudulent.",
              "If you create an account, keep your login details secure.",
            ],
          },
          {
            id: "products",
            title: "Products & fragrance notes",
            paragraphs: [
              "Product descriptions, notes, and imagery are provided to help you choose—minor variations can occur due to batch, lighting, and display settings.",
              "Perfumes are cosmetic products intended for scent only. We do not make medical or therapeutic claims.",
            ],
            bullets: [
              "Patch-test if you have sensitive skin, and discontinue use if irritation occurs.",
              "Keep away from heat/flame and out of reach of children.",
            ],
          },
          {
            id: "pricing",
            title: "Pricing, taxes, and promotions",
            paragraphs: [
              "All prices are shown in JOD. Prices and availability may change at any time.",
              "Promotions are subject to availability and may be withdrawn or modified without prior notice, unless prohibited by law.",
            ],
            bullets: ["Shipping fee (if applicable) is shown at checkout.", "Discount codes apply only as described."],
          },
          {
            id: "orders",
            title: "Orders, payment, and confirmation",
            paragraphs: [
              "An order is considered accepted when we confirm it (email/WhatsApp/SMS) or when it is dispatched.",
              "Online card payments are processed through PayTabs. Cash on Delivery (COD) may be available depending on your location.",
            ],
            bullets: ["For COD orders, we may contact you to confirm before dispatch.", "If a payment fails, the order may be cancelled."],
          },
          {
            id: "delivery",
            title: "Delivery",
            paragraphs: [
              "Delivery time estimates are provided as guidance and may vary by area, holidays, or operational constraints.",
              "Risk of loss transfers to you upon delivery to the provided address.",
            ],
            bullets: ["Please ensure someone is available to receive the parcel.", "If a delivery attempt fails, re-delivery fees may apply."],
          },
          {
            id: "returns",
            title: "Returns & exchanges",
            paragraphs: [
              "For hygiene and safety, opened or used perfumes are typically not returnable.",
              "If your item arrives damaged, defective, or incorrect, contact us within 48 hours with clear photos so we can resolve it.",
            ],
            bullets: [
              "Eligible returns must be unopened, unused, and in original condition.",
              "Refunds (when applicable) are issued to the original payment method after inspection.",
            ],
          },
          {
            id: "ip",
            title: "Intellectual property",
            paragraphs: [
              "All content on the site (text, images, trademarks, designs) belongs to NIVRAN or its licensors.",
              "You may not copy, reproduce, or use content without written permission.",
            ],
            bullets: ["You may share product links for personal use."],
          },
          {
            id: "liability",
            title: "Limitation of liability",
            paragraphs: [
              "To the extent permitted by law, NIVRAN is not liable for indirect, incidental, or consequential damages arising from use of the site or products.",
              "Nothing in these Terms limits liability where such limitation is not permitted by law.",
            ],
            bullets: ["Always follow usage and safety instructions on the packaging."],
          },
          {
            id: "law",
            title: "Governing law & disputes",
            paragraphs: [
              "These Terms are governed by the laws of Jordan.",
              "If a dispute arises, we encourage you to contact us first to resolve it informally.",
            ],
            bullets: ["Contact: hello@nivran.com"],
          },
          {
            id: "changes",
            title: "Changes to these Terms",
            paragraphs: ["We may update these Terms from time to time. The latest version will be posted here with an updated date."],
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

          <div style={{ borderTop: "1px solid rgba(0,0,0,.08)", marginTop: ".9rem", paddingTop: ".9rem" }}>
            <p className="muted" style={{ marginTop: 0, marginBottom: ".5rem" }}>
              {isAr ? "هل تحتاج مساعدة؟" : "Need help?"}
            </p>
            <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
              <a className="btn" href="mailto:hello@nivran.com">{isAr ? "البريد" : "Email"}</a>
              <a className="btn" href="tel:+962791752686">{isAr ? "اتصال" : "Call"}</a>
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
