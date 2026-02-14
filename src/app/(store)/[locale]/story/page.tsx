export default async function StoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <section style={{ padding: "1.2rem 0" }}>
      <article className="panel" style={{ display: "grid", gap: 10 }}>
        <div className="kicker">{isAr ? "عن العلامة" : "Our Story"}</div>
        <h1 className="title" style={{ marginTop: 0 }}>{isAr ? "قصّتنا" : "Our Story"}</h1>

        {isAr ? (
          <>
            <p>وُلدت نيفـران من حاجة بسيطة: أن نعيش لحظة هدوء في عالم لا يتوقف.</p>
            <p>نصنع عطورًا نظيفة وبسيطة، للجميع، بروحٍ منعشة تجمع بين الحمضيات والمسك الأبيض — توقيعًا خفيفًا يرافقك دون ضجيج.</p>
            <p>اخترنا التصنيع داخل الأردن لأننا نؤمن أن التحكم بالتفاصيل هو الطريق للجودة: من المزج إلى الاختبار، ومن الثبات إلى الاتساق.</p>
            <p>نيفـران ليست ضجة… بل توازن.</p>
            <p style={{ marginBottom: 0 }}><strong>ارتدِ الهدوء.</strong></p>
          </>
        ) : (
          <>
            <p>NIVRAN was born from a simple need: to feel calm in a world that rarely slows down.</p>
            <p>Some days, you don’t need something louder. You need something cleaner. Something that sits close, feels fresh, and quietly resets your mood.</p>
            <p>We’re building NIVRAN in Jordan with one clear philosophy: less noise, more clarity. Our fragrances are unisex by intention — fresh citrus to lift the day, white musk to keep it smooth, and a minimalist signature that feels like it belongs to you.</p>
            <h2 style={{ marginBottom: 0 }}>{isAr ? "مصمم بقصد" : "Crafted with intention"}</h2>
            <p>We chose in-house manufacturing on purpose. It gives us control over blending, testing, and consistency from one bottle to the next.</p>
            <h2 style={{ marginBottom: 0 }}>{isAr ? "مصمم للحياة في الأردن" : "Designed for real life in Jordan"}</h2>
            <p>NIVRAN is made for office mornings, evening drives, coffee runs, quiet moments, and thoughtful gifting — accessible premium with dependable quality.</p>
            <p style={{ marginBottom: 0 }}><strong>Wear the calm. And let the day meet you where you are.</strong></p>
          </>
        )}
      </article>
    </section>
  );
}
