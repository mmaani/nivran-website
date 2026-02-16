export default async function PrivacyPage({
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
        title: "سياسة الخصوصية",
        intro: "كيف تجمع نيفـران المعلومات الشخصية وتستخدمها.",
        sections: [
          {
            id: "what",
            title: "ما البيانات التي نجمعها",
            paragraphs: [
              "نجمع البيانات التي تزودنا بها عند إتمام الطلب أو التواصل مع الدعم أو الاشتراك بالتحديثات.",
              "قد تشمل: الاسم، البريد الإلكتروني، رقم الهاتف، عنوان التوصيل، وتفاصيل الطلب.",
            ],
            bullets: ["يتم الدفع بالبطاقة عبر PayTabs على صفحة دفع مستضافة؛ نحن لا نخزن بيانات بطاقتك كاملة."],
          },
          {
            id: "how",
            title: "كيف نستخدم بياناتك",
            paragraphs: [
              "نستخدم بياناتك لمعالجة الطلبات والتوصيل وتقديم الدعم ومنع الاحتيال وتحسين تجربة المتجر.",
              "إذا وافقت على التسويق، قد نرسل لك تحديثات وعروضًا ويمكنك إلغاء الاشتراك في أي وقت.",
            ],
            bullets: ["معالجة الطلبات والتنفيذ", "خدمة العملاء والتواصل", "الأمان ومنع الاحتيال"],
          },
          {
            id: "sharing",
            title: "متى نشارك البيانات",
            paragraphs: [
              "نشارك الحد الأدنى اللازم من البيانات مع مزودي الخدمة لتشغيل المتجر.",
              "مثل: شركات التوصيل، مزودي الدفع، الاستضافة، وأدوات التحليلات.",
            ],
            bullets: ["لا نبيع بياناتك الشخصية."],
          },
          {
            id: "cookies",
            title: "ملفات الارتباط والتحليلات",
            paragraphs: ["نستخدم ملفات ارتباط أساسية لعمل الموقع (مثل السلة والجلسة).", "قد نستخدم تحليلات لفهم استخدام الموقع وتحسين الأداء."],
            bullets: ["يمكنك التحكم بملفات الارتباط من إعدادات المتصفح."],
          },
          {
            id: "retention",
            title: "مدة الاحتفاظ بالبيانات",
            paragraphs: ["نحتفظ بالبيانات للمدة اللازمة فقط للأغراض المذكورة، بما في ذلك المتطلبات القانونية والمحاسبية."],
          },
          {
            id: "rights",
            title: "حقوقك",
            paragraphs: ["يمكنك طلب الوصول لبياناتك أو تصحيحها أو حذفها وفق القوانين المعمول بها وبما لا يتعارض مع المتطلبات النظامية."],
            bullets: ["التواصل: hello@nivran.com"],
          },
          {
            id: "security",
            title: "الأمان",
            paragraphs: [
              "نطبق إجراءات تقنية وتنظيمية معقولة لحماية بياناتك.",
              "لا توجد خدمة عبر الإنترنت آمنة 100%—استخدم كلمة مرور قوية واحمِ أجهزتك.",
            ],
          },
          {
            id: "changes",
            title: "تعديل هذه السياسة",
            paragraphs: ["قد نقوم بتحديث هذه السياسة. ستجد دائمًا أحدث نسخة هنا مع تحديث التاريخ."],
          },
        ],
      }
    : {
        title: "Privacy Policy",
        intro: "How NIVRAN collects and uses personal information.",
        sections: [
          {
            id: "what",
            title: "What we collect",
            paragraphs: [
              "We collect information you provide to place an order, contact support, or sign up for updates.",
              "This may include name, email, phone, delivery address, and order details.",
            ],
            bullets: ["Payment card details are processed by PayTabs on a hosted page; we do not store your full card details."],
          },
          {
            id: "how",
            title: "How we use your data",
            paragraphs: [
              "We use your information to process orders, deliver products, provide customer support, prevent fraud, and improve the store experience.",
              "If you opt-in to marketing, we may send product updates or offers. You can unsubscribe any time.",
            ],
            bullets: ["Order processing and fulfillment", "Customer support and communications", "Security and fraud prevention"],
          },
          {
            id: "sharing",
            title: "When we share data",
            paragraphs: [
              "We share only what is necessary with service providers to run the store.",
              "Examples include delivery partners, payment providers, hosting and analytics tools.",
            ],
            bullets: ["We do not sell your personal information."],
          },
          {
            id: "cookies",
            title: "Cookies & analytics",
            paragraphs: ["We use essential cookies for site functionality (such as cart and session).", "We may use analytics to understand site usage and improve performance."],
            bullets: ["You can control cookies through your browser settings."],
          },
          {
            id: "retention",
            title: "Data retention",
            paragraphs: ["We keep personal data only as long as necessary for the purposes described, including legal and accounting requirements."],
          },
          {
            id: "rights",
            title: "Your rights",
            paragraphs: ["You may request access, correction, or deletion of your personal information, subject to applicable law and legitimate business needs."],
            bullets: ["Contact: hello@nivran.com"],
          },
          {
            id: "security",
            title: "Security",
            paragraphs: ["We use reasonable technical and organizational measures to protect your data.", "No online service is 100% secure; please use strong passwords and keep your devices secure."],
          },
          {
            id: "changes",
            title: "Changes to this policy",
            paragraphs: ["We may update this policy. The latest version will always be posted here with an updated date."],
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
