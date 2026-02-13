export type Locale = "en" | "ar";

export type ProductCategory = "perfume" | "hand-gel" | "cream" | "air-freshener" | "soap";
export type Audience = "women" | "men" | "unisex";

export type Product = {
  slug: string;
  category: ProductCategory;
  audience: Audience;
  name: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  description: Record<Locale, string>;
  notes: Record<Locale, string[]>;
  size: string;
  priceJod: number;
  featured?: boolean;
};

export const categoryLabels: Record<ProductCategory, Record<Locale, string>> = {
  perfume: { en: "Perfume", ar: "عطور" },
  "hand-gel": { en: "Hand Gel", ar: "جل يدين" },
  cream: { en: "Cream", ar: "كريم" },
  "air-freshener": { en: "Air Freshener", ar: "معطر جو" },
  soap: { en: "Soap", ar: "صابون" },
};

export const products: Product[] = [
  {
    slug: "nivran-calm-100ml",
    category: "perfume",
    audience: "unisex",
    name: { en: "NIVRAN Calm", ar: "نيفـران كالم" },
    subtitle: {
      en: "Refined eau de parfum created for all-day elegance",
      ar: "عطر راقٍ مصمم للأناقة طوال اليوم",
    },
    description: {
      en: "A clean profile that opens bright, settles soft, and stays balanced from day to night.",
      ar: "تركيبة نظيفة تبدأ منعشة ثم تستقر بنعومة وتبقى متوازنة من الصباح للمساء.",
    },
    notes: {
      en: ["Bergamot", "White tea", "Soft cedar"],
      ar: ["برغموت", "شاي أبيض", "أرز ناعم"],
    },
    size: "100ml",
    priceJod: 18,
    featured: true,
  },
  {
    slug: "nivran-noir-100ml",
    category: "perfume",
    audience: "men",
    name: { en: "NIVRAN Noir", ar: "نيفـران نوير" },
    subtitle: {
      en: "Deep woody signature for evening confidence",
      ar: "توقيع خشبي عميق لثقة المساء",
    },
    description: {
      en: "A richer profile with warm woods and amber depth designed for long evening wear.",
      ar: "تركيبة أغنى بنفحات خشبية وعنبريّة لثبات مناسب لفترات المساء.",
    },
    notes: {
      en: ["Cardamom", "Amber wood", "Patchouli"],
      ar: ["هيل", "خشب عنبري", "باتشولي"],
    },
    size: "100ml",
    priceJod: 22,
  },
  {
    slug: "nivran-bloom-75ml",
    category: "perfume",
    audience: "women",
    name: { en: "NIVRAN Bloom", ar: "نيفـران بلوم" },
    subtitle: {
      en: "Soft floral blend for daily feminine wear",
      ar: "مزيج زهري ناعم للاستخدام اليومي",
    },
    description: {
      en: "A bright floral composition with smooth musk designed for fresh daytime style.",
      ar: "تركيبة زهرية مشرقة مع مسك ناعم تمنح حضوراً منعشاً خلال النهار.",
    },
    notes: {
      en: ["Peony", "Orange blossom", "Clean musk"],
      ar: ["فاوانيا", "زهر البرتقال", "مسك نقي"],
    },
    size: "75ml",
    priceJod: 19,
  },
  {
    slug: "nivran-care-hand-gel-60ml",
    category: "hand-gel",
    audience: "unisex",
    name: { en: "NIVRAN Care Hand Gel", ar: "نيفـران كير جل يدين" },
    subtitle: {
      en: "Quick-clean hand gel with light fragrance",
      ar: "جل يدين سريع التنظيف بعطر خفيف",
    },
    description: {
      en: "Portable hand gel for everyday hygiene with a clean, light scent.",
      ar: "جل يدين محمول للنظافة اليومية مع رائحة خفيفة ونظيفة.",
    },
    notes: { en: ["Clean citrus"], ar: ["حمضيات نظيفة"] },
    size: "60ml",
    priceJod: 4.5,
  },
  {
    slug: "nivran-soft-cream-100ml",
    category: "cream",
    audience: "unisex",
    name: { en: "NIVRAN Soft Cream", ar: "نيفـران سوفت كريم" },
    subtitle: {
      en: "Light daily hand & body cream",
      ar: "كريم يومي خفيف لليدين والجسم",
    },
    description: {
      en: "Fast-absorbing cream with subtle scent for smooth daily care.",
      ar: "كريم سريع الامتصاص برائحة لطيفة للعناية اليومية.",
    },
    notes: { en: ["Cotton musk"], ar: ["مسك قطني"] },
    size: "100ml",
    priceJod: 6.5,
  },
  {
    slug: "nivran-air-freshener-250ml",
    category: "air-freshener",
    audience: "unisex",
    name: { en: "NIVRAN Air Freshener", ar: "نيفـران معطر جو" },
    subtitle: {
      en: "Room mist for home and office",
      ar: "رذاذ منزلي للمكتب والمنزل",
    },
    description: {
      en: "Refreshing room spray with balanced scent projection for shared spaces.",
      ar: "معطر رذاذ منعش بثبات متوازن للمساحات المشتركة.",
    },
    notes: { en: ["Green tea", "Citrus"], ar: ["شاي أخضر", "حمضيات"] },
    size: "250ml",
    priceJod: 7.5,
  },
  {
    slug: "nivran-gentle-soap-120g",
    category: "soap",
    audience: "unisex",
    name: { en: "NIVRAN Gentle Soap", ar: "نيفـران صابون لطيف" },
    subtitle: {
      en: "Mild scented cleansing bar",
      ar: "صابون تنظيف لطيف برائحة خفيفة",
    },
    description: {
      en: "Everyday cleansing bar with soft foam and comfortable fragrance.",
      ar: "قطعة صابون يومية برغوة ناعمة ورائحة مريحة.",
    },
    notes: { en: ["Fresh musk"], ar: ["مسك منعش"] },
    size: "120g",
    priceJod: 2,
  },
];

export const featuredProduct = products.find((p) => p.featured) || products[0];

export const mainProductMessage = {
  en: "Our core line is perfume, with new lifestyle categories expanding gradually.",
  ar: "خطنا الأساسي هو العطور، مع توسع تدريجي في فئات لايف ستايل إضافية.",
};

export const benefits = {
  en: [
    { title: "Perfume-first craft", body: "Our fragrance line is the core of NIVRAN, built with premium scent balance." },
    { title: "Multi-category roadmap", body: "Hand gel, cream, air freshener, and soap are expanding in selected sizes." },
    { title: "Built for Jordan", body: "Pricing, delivery, and support designed for local convenience." },
  ],
  ar: [
    { title: "خبرة عطور أولاً", body: "العطور هي قلب نيفـران مع تركيبات متوازنة بجودة عالية." },
    { title: "توسع متعدد الفئات", body: "جل اليدين والكريم ومعطر الجو والصابون تتوسع تدريجياً بأحجام مختارة." },
    { title: "مصمم للأردن", body: "تسعير وتوصيل وخدمة مناسبة للعميل المحلي." },
  ],
};

export const testimonials = {
  en: [
    { name: "Lina", text: "Looks premium, smells polished, and lasts through my workday." },
    { name: "Omar", text: "NIVRAN perfume line feels signature without being overpowering." },
    { name: "Rana", text: "Checkout was smooth and the packaging felt high-end." },
  ],
  ar: [
    { name: "لينا", text: "التجربة فاخرة والرائحة أنيقة وثابتة خلال اليوم." },
    { name: "عمر", text: "خط العطور من نيفـران مميز بدون مبالغة في الرائحة." },
    { name: "رنا", text: "الدفع كان سلس والتغليف فعلاً فاخر." },
  ],
};
