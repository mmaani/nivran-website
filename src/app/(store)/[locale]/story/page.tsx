export default async function StoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <section style={{ padding: "1.2rem 0" }}>
      <article className="panel">
        <div className="kicker">{isAr ? "عن العلامة" : "About the brand"}</div>
        <h1 className="title">{isAr ? "قصة نيفـران" : "The NIVRAN story"}</h1>
        <p>
          {isAr
            ? "بدأت نيفـران لتقديم تجربة عطور راقية بلمسة محلية حديثة: تصميم واضح، مكونات دقيقة، وخدمة سريعة. هدفنا أن نجعل اختيار العطر أسهل وأكثر ثقة على الجوال والكمبيوتر."
            : "NIVRAN started to deliver a premium fragrance experience with a modern local identity: clear design, intentional formulas, and fast service. We focus on making fragrance shopping easier on both mobile and desktop."}
        </p>
        <p style={{ marginBottom: 0 }}>{isAr ? "الشعار: ارتدِ الهدوء." : "Tagline: Wear the calm."}</p>
      </article>
    </section>
  );
}
