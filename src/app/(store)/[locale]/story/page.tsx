export default async function StoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860, margin: "0 auto" }}>
      <a href={`/${locale}`} style={{ textDecoration: "underline" }}>
        {isAr ? "رجوع" : "Back"}
      </a>

      <h1 style={{ marginTop: 14 }}>{isAr ? "قصة نيفـران" : "The NIVRAN story"}</h1>

      <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        <p style={{ marginTop: 0 }}>
          {isAr
            ? "نيفـران علامة عطور أردنية داخلية التصنيع بروح نظيفة وبسيطة. نركز على تجربة عطرية منعشة ومحايدة بعبارات آمنة للادعاءات."
            : "NIVRAN is an in-house Jordan perfume brand with a clean, minimalist point of view. We focus on a fresh unisex profile with claim-safe language."}
        </p>
        <p style={{ marginBottom: 0 }}>
          {isAr ? "الشعار: ارتدِ الهدوء." : "Tagline direction: Wear the calm."}
        </p>
      </div>
    </div>
  );
}
