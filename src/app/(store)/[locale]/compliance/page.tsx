export default async function CompliancePage({
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
        title: "الجودة والالتزام",
        intro: "كيف تتعامل نيفـران مع السلامة والتواصل المسؤول والعناية بمنتجاتها.",
        sections: [
          {
            id: "safety",
            title: "سلامة المنتج والاستخدام المسؤول",
            paragraphs: [
              "منتجات نيفـران تشمل العطور ومنتجات العناية الشخصية المشابهة مثل الكريمات والصابون.",
              "هذه المنتجات تجميلية/عناية شخصية ومخصّصة للعناية اليومية أو الرائحة فقط.",
              "يرجى الاستخدام وفق الإرشادات: تجنب ملامسة العينين أو الجلد المتشقق وتجنب الابتلاع.",
            ],
            bullets: ["إن كانت بشرتك حساسة، اختبر المنتج أولًا وأوقف الاستخدام عند التهيّج.", "يُحفظ بعيدًا عن متناول الأطفال."],
          },
          {
            id: "allergens",
            title: "المكوّنات والمحسّسات",
            paragraphs: [
              "مثل معظم المنتجات التجميلية، قد تحتوي التركيبات على مكوّنات قد تسبب حساسية لدى البعض.",
              "راجع معلومات المكوّنات/المحسّسات على العبوة إن كانت متاحة.",
            ],
            bullets: ["إذا لديك حساسية معروفة، استشر مختصًا قبل الاستخدام."],
          },
          {
            id: "claims",
            title: "تواصل مسؤول (بدون ادعاءات طبية)",
            paragraphs: ["نلتزم بصياغات تسويقية آمنة وخالية من الادعاءات الطبية أو العلاجية.", "نصف الرائحة والمزاج والتجربة—وليس فوائد صحية."],
          },
          {
            id: "flammable",
            title: "قابلية الاشتعال",
            paragraphs: ["قد تكون بعض العطور محتوية على كحول وقابلة للاشتعال.", "تُحفظ بعيدًا عن الحرارة والشرر واللهب ولا تُستخدم قرب النار."],
          },
          {
            id: "auth",
            title: "الأصالة",
            paragraphs: ["لضمان الأصالة والجودة، اشترِ منتجات نيفـران من متجرنا الرسمي أو القنوات المعتمدة."],
            bullets: ["إذا اشتبهت بمنتج مقلّد، تواصل معنا عبر hello@nivran.com."],
          },
        ],
      }
    : {
        title: "Quality & Compliance",
        intro: "How NIVRAN approaches safety, responsible communication, and product care across its range.",
        sections: [
          {
            id: "safety",
            title: "Product safety & responsible use",
            paragraphs: ["NIVRAN products include perfumes and other personal care items such as creams, soaps, and similar cosmetic products.",
              "These are cosmetic/personal care products intended for scent or routine care only.", "Always use as directed: avoid contact with eyes, broken skin, or ingestion."],
            bullets: ["Patch-test if you have sensitive skin; discontinue use if irritation occurs.", "Keep out of reach of children."],
          },
          {
            id: "allergens",
            title: "Ingredients & allergens",
            paragraphs: ["Like most cosmetic products, formulas may contain materials that can trigger sensitivity for some people.", "Check the packaging ingredient/allergen information when available."],
            bullets: ["If you have known allergies, consult a healthcare professional before use."],
          },
          {
            id: "claims",
            title: "Claim-safe communication (no medical claims)",
            paragraphs: ["We use responsible, claim-safe wording—no medical or therapeutic promises.", "We describe scent, mood, and experience—not health benefits."],
          },
          {
            id: "flammable",
            title: "Flammability",
            paragraphs: ["Some perfumes are alcohol-based and flammable.", "Store away from heat, sparks, and open flame; do not spray near fire."],
          },
          {
            id: "auth",
            title: "Authenticity",
            paragraphs: ["To ensure authenticity and quality, purchase NIVRAN products through our official store or authorized channels."],
            bullets: ["If you suspect a counterfeit, contact us at hello@nivran.com."],
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
        <aside className="panel policy-contents">
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
