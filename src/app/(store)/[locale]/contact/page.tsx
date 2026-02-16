import ContactForm from "./ContactForm";

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  return (
    <div style={{ padding: "1.2rem 0" }}>
      <h1 className="title">{isAr ? "تواصل معنا" : "Contact us"}</h1>
      <div className="grid-2">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>{isAr ? "الدعم" : "Support"}</h3>
          <p>{isAr ? "فريقنا يرد خلال يوم عمل واحد." : "Our team responds within one business day."}</p>
          <p style={{ marginBottom: 0 }}>
            <a href="mailto:hello@nivran.com">hello@nivran.com</a>
            <br />
            <a href="tel:+962791752686">+962791752686</a>
            <br />
            <a href="https://wa.me/962791752686" target="_blank" rel="noreferrer">
              {isAr ? "راسلنا على واتساب" : "Message us on WhatsApp"}
            </a>
          </p>
        </section>
        <section className="panel">
          <ContactForm locale={locale} />
        </section>
      </div>
    </div>
  );
}
