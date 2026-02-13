export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 6 }}>{isAr ? "نيفـران" : "NIVRAN"}</h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        {isAr ? "ارتدِ الهدوء" : "Wear the calm."}
      </p>

      <div style={{ marginTop: 14 }}>
        <a href={`/${locale}/checkout`} style={{ textDecoration: "underline" }}>
          {isAr ? "اذهب إلى الدفع" : "Go to Checkout"}
        </a>
      </div>
    </div>
  );
}
