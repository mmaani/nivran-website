export type Locale = "en" | "ar";

type Product = {
  slug: string;
  name: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  priceJod: number;
  size: string;
  notes: Record<Locale, string[]>;
  description: Record<Locale, string>;
};

export const featuredProduct: Product = {
  slug: "nivran-calm-100ml",
  name: { en: "NIVRAN Calm", ar: "نيفـران كالم" },
  subtitle: {
    en: "Refined eau de parfum created for all-day elegance",
    ar: "عطر راقٍ مصمم للأناقة طوال اليوم",
  },
  priceJod: 18,
  size: "100ml",
  notes: {
    en: ["Bergamot", "White tea", "Soft cedar"],
    ar: ["برغموت", "شاي أبيض", "أرز ناعم"],
  },
  description: {
    en: "A clean profile that opens bright, settles soft, and stays balanced from day to night.",
    ar: "تركيبة نظيفة تبدأ منعشة ثم تستقر بنعومة وتبقى متوازنة من الصباح للمساء.",
  },
};

export const benefits = {
  en: [
    { title: "Boutique quality", body: "Small-batch blending, controlled filling, and precise finishing." },
    { title: "Built for Jordan", body: "Pricing, delivery, and support designed for local convenience." },
    { title: "Fast support", body: "WhatsApp and email help before purchase and after delivery." },
  ],
  ar: [
    { title: "جودة بوتيك", body: "تحضير بدفعات صغيرة مع تعبئة وضبط نهائي دقيق." },
    { title: "مصمم للأردن", body: "تسعير وتوصيل وخدمة مناسبة للعميل المحلي." },
    { title: "دعم سريع", body: "مساعدة عبر واتساب والبريد قبل الشراء وبعد التسليم." },
  ],
};

export const testimonials = {
  en: [
    { name: "Lina", text: "Looks premium, smells polished, and lasts through my workday." },
    { name: "Omar", text: "One of the cleanest signature scents I’ve worn in a long time." },
    { name: "Rana", text: "The mobile checkout was super easy and delivery was fast." },
  ],
  ar: [
    { name: "لينا", text: "التجربة فاخرة والرائحة أنيقة وثابتة خلال اليوم." },
    { name: "عمر", text: "من أنظف العطور اللي اعتمدتها كعطر أساسي." },
    { name: "رنا", text: "الدفع من الجوال سهل جداً والتوصيل كان سريع." },
  ],
};
