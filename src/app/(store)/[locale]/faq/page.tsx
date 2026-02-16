export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";
  const isAr = locale === "ar";

  const faqs: Array<[string, string]> = isAr
    ? [
        [
          "ما هي نيفـران (NIVRAN)؟",
          "نيفـران علامة عطور أردنية بطابع نظيف ومينيمال، للجنسين، وبهوية منعشة وهادئة. شعارنا: Wear the calm. (ارتدِ الهدوء).",
        ],
        [
          "هل عطور نيفـران مناسبة للجنسين؟",
          "نعم. معظم إصداراتنا مُصمّمة لتكون للجنسين. اختر حسب النفحات والمزاج أكثر من التصنيف.",
        ],
        [
          "هل لديكم ادعاءات صحية أو علاجية؟",
          "لا. عطور نيفـران منتجات تجميلية مخصّصة للرائحة فقط، ونلتزم بصياغات آمنة بدون أي ادعاءات طبية.",
        ],
        [
          "ما تركيز العطر (EDP/EDT) وما الحجم؟",
          "تجد التركيز (مثل EDP/EDT) والحجم بشكل واضح في صفحة كل منتج ووصفه.",
        ],
        [
          "هل تلتزمون بمعايير السلامة للعطور (IFRA)؟",
          "نلتزم بمبادئ الاستخدام الآمن لمكوّنات العطور ونراعي حدود الاستخدام المتعارف عليها في صناعة العطور وفق معايير IFRA.",
        ],
        [
          "هل توجد مكوّنات/محسّسات يجب الانتباه لها؟",
          "مثل معظم العطور، قد تحتوي التركيبة العطرية على مواد قد تسبب حساسية لدى البعض. راجع قائمة المكوّنات على العبوة إن كانت متاحة، وأوقف الاستخدام إذا ظهر تهيّج.",
        ],
        [
          "كيف أختار العطر المناسب لي؟",
          "ابدأ بالنفحات التي تحبها (حمضيات/مسك/خشبي/منعش). إذا كنت غير متأكد، اختر الخيارات “Fresh/clean” أو ابدأ بالحجم الأصغر (إن كان متاحًا).",
        ],
        [
          "كيف أحفظ العطر بأفضل شكل؟",
          "احفظه في مكان بارد وجاف بعيدًا عن الشمس والحرارة المباشرة (مثل السيارة أو قرب النافذة) للحفاظ على ثبات الرائحة.",
        ],
        ["كم رسوم الشحن داخل الأردن؟", "رسوم ثابتة 3.5 دينار داخل الأردن."],
        [
          "كم مدة التوصيل؟",
          "عادة خلال 1–3 أيام عمل حسب المنطقة (قد تزيد قليلًا في بعض المناطق البعيدة أو خلال ضغط المواسم).",
        ],
        [
          "هل يتوفر الدفع عند الاستلام (COD)؟",
          "نعم، الدفع عند الاستلام متاح داخل الأردن (وقد تظهر أيضًا خيارات دفع إلكتروني حسب صفحة الدفع).",
        ],
        [
          "ما طرق الدفع الإلكتروني؟ وهل الدفع آمن؟",
          "نقبل الدفع بالبطاقات عبر بوابة PayTabs، وقد تتوفر Apple Pay إذا كانت مفعّلة ضمن خيارات الدفع لديك أثناء إتمام الطلب.",
        ],
        [
          "كيف أتابع طلبي؟",
          "بعد إتمام الطلب ستصلك رسالة تأكيد. عند الشحن سنشاركك تحديثات التتبع (إن كانت متاحة) بحسب شركة التوصيل.",
        ],
        [
          "هل يمكن تعديل أو إلغاء الطلب بعد إرساله؟",
          "إذا احتجت تعديلًا أو إلغاءً، تواصل معنا فورًا. إذا كان الطلب لم يُشحن بعد سنحاول مساعدتك بحسب الإمكانية.",
        ],
        [
          "ما سياسة الاستبدال/الاسترجاع؟",
          "حرصًا على السلامة والنظافة، المنتجات المفتوحة غالبًا لا تُسترجع. إذا وصلتك عبوة تالفة أو منتج غير مطابق، تواصل معنا خلال 48 ساعة مع صور واضحة وسنقوم بالإجراء المناسب وفق الشروط.",
        ],
        [
          "هل يتوفر تغليف هدايا أو رسالة إهداء؟",
          "إن كانت خيارات الإهداء متاحة لطلبك فستظهر أثناء إتمام الشراء. ويمكنك أيضًا مراسلتنا بخصوص ذلك.",
        ],
        [
          "هل توجد عروض للشركات أو طلبات بالجملة؟",
          "نعم. للتجهيزات الخاصة، هدايا الشركات، أو طلبات بالجملة: تواصل معنا وسنقترح لك خيارًا مناسبًا.",
        ],
      ]
    : [
        [
          "What is NIVRAN?",
          "NIVRAN is a Jordan-based fragrance brand with a clean, minimalist identity—unisex, fresh, and calm by design. Tagline: Wear the calm.",
        ],
        [
          "Are NIVRAN fragrances unisex?",
          "Yes. Most releases are designed to be unisex—choose by notes and mood rather than gender labels.",
        ],
        [
          "Do you make health or therapeutic claims?",
          "No. Our products are cosmetic fragrances only, and we use claim-safe wording (no medical or therapeutic claims).",
        ],
        [
          "What concentration (EDP/EDT) and size am I buying?",
          "The concentration (e.g., EDP/EDT) and size are listed on each product page and in the product description.",
        ],
        [
          "Do you follow IFRA safety guidance?",
          "We formulate with safe-use principles and widely used industry limits in mind, aligned with IFRA Standards guidance.",
        ],
        [
          "Do your products contain allergens?",
          "Like most fragrances, they may contain materials that can trigger sensitivity for some people. Check the ingredient list on the packaging when available, and discontinue use if irritation occurs.",
        ],
        [
          "How do I choose the right scent?",
          "Start with notes you already love (citrus / musk / woody / fresh). If you’re unsure, begin with the most “fresh/clean” profile or a smaller size when available.",
        ],
        [
          "How should I store my perfume?",
          "Store it in a cool, dry place away from direct sunlight and heat (avoid leaving it in a car or by a window).",
        ],
        ["What is the shipping fee?", "Flat 3.5 JOD across Jordan."],
        [
          "How long does delivery take?",
          "Usually 1–3 business days depending on the area (some remote areas or peak seasons may take a bit longer).",
        ],
        [
          "Do you offer Cash on Delivery (COD)?",
          "Yes—Cash on Delivery is available in Jordan (and you may also see online payment options at checkout).",
        ],
        [
          "What online payment methods do you accept?",
          "We accept card payments through PayTabs, and Apple Pay may appear at checkout if enabled for your payment flow.",
        ],
        [
          "How can I track my order?",
          "You’ll receive an order confirmation, and we’ll share shipping/tracking updates when available through the delivery partner.",
        ],
        [
          "Can I change or cancel my order?",
          "If you need a change or cancellation, contact us as soon as possible. If the order hasn’t shipped yet, we’ll do our best to help.",
        ],
        [
          "What is your return/exchange policy?",
          "For hygiene and safety, opened products are typically not returnable. If your order arrives damaged or incorrect, contact us within 48 hours with clear photos and we’ll resolve it per our terms.",
        ],
        [
          "Do you offer gift wrapping or gift notes?",
          "If gifting options are available for your order, they’ll appear during checkout. You can also message us for special requests.",
        ],
        [
          "Do you support wholesale or corporate gifting?",
          "Yes—contact us for wholesale, corporate gifting, or bulk orders and we’ll propose the right option.",
        ],
      ];
return (
  <div style={{ padding: "1.2rem 0" }}>
    <h1 className="title">{isAr ? "الأسئلة الشائعة" : "Frequently asked questions"}</h1>

    {/* tiny behavior-only styling for the chevron */}
    <style>{`
      details > summary { list-style: none; }
      details > summary::-webkit-details-marker { display: none; }
      .faq-chevron { transition: transform 150ms ease; opacity: .7; }
      details[open] > summary .faq-chevron { transform: rotate(180deg); }
    `}</style>

    <div style={{ display: "grid", gap: ".8rem" }}>
      {faqs.map(([q, a]) => (
        <article key={q} className="panel">
          {/* same name => exclusive accordion */}
          <details name="nivran-faq">
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <span>{q}</span>
              <span className="faq-chevron" aria-hidden="true">▾</span>
            </summary>

            <div style={{ marginTop: ".65rem" }}>
              <p style={{ marginBottom: 0 }} className="muted">
                {a}
              </p>
            </div>
          </details>
        </article>
      ))}
    </div>
  </div>
);

}
