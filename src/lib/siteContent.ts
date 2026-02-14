export type Locale = "en" | "ar";

export type ProductCategory = "perfume" | "hand-gel" | "cream" | "air-freshener" | "soap";
export type Audience = "women" | "men" | "unisex";
export type ScentFamily = "fresh" | "citrus" | "musk";
export type Concentration = "EDP" | "EDT" | "CARE";

export type ProductVariant = {
  id: string;
  sizeLabel: "10ml" | "60ml" | "75ml" | "100ml" | "120g" | "250ml";
  sizeSort: number;
  priceJod: number;
  compareAtPriceJod?: number;
  inStock: boolean;
  isDefault?: boolean;
};

export type Product = {
  slug: string;
  category: ProductCategory;
  audience: Audience;
  concentration: Concentration;
  scentFamily: ScentFamily[];
  name: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  description: Record<Locale, string>;
  notes: Record<Locale, string[]>;
  images: string[]; // up to 5 images
  variants: ProductVariant[];
  featured?: boolean;
};

export const categoryLabels: Record<ProductCategory, Record<Locale, string>> = {
  perfume: { en: "Perfume", ar: "عطور" },
  "hand-gel": { en: "Hand Gel", ar: "جل يدين" },
  cream: { en: "Cream", ar: "كريم" },
  "air-freshener": { en: "Air Freshener", ar: "معطر جو" },
  soap: { en: "Soap", ar: "صابون" },
};

export const scentFamilyLabels: Record<ScentFamily, Record<Locale, string>> = {
  fresh: { en: "Fresh", ar: "منعش" },
  citrus: { en: "Citrus", ar: "حمضيات" },
  musk: { en: "Musk", ar: "مسك" },
};

export const concentrationLabels: Record<Concentration, Record<Locale, string>> = {
  EDP: { en: "EDP", ar: "أو دو برفيوم" },
  EDT: { en: "EDT", ar: "أو دو تواليت" },
  CARE: { en: "Care", ar: "عناية" },
};

function variant(id: string, sizeLabel: ProductVariant["sizeLabel"], sizeSort: number, priceJod: number, isDefault = false): ProductVariant {
  return { id, sizeLabel, sizeSort, priceJod, inStock: true, isDefault };
}

export const products: Product[] = [
  {
    slug: "nivran-calm",
    category: "perfume",
    audience: "unisex",
    concentration: "EDP",
    scentFamily: ["fresh", "citrus", "musk"],
    name: { en: "NIVRAN Calm", ar: "نيفـران كالم" },
    subtitle: {
      en: "Clean citrus and white musk for everyday balance",
      ar: "حمضيات نظيفة ومسك أبيض لتوازن يومي",
    },
    description: {
      en: "A bright opening with soft white musk and a smooth clean trail that feels calm, close, and modern.",
      ar: "افتتاحية مشرقة مع مسك أبيض ناعم وأثر نظيف هادئ بقرب أنيق وعصري.",
    },
    notes: {
      en: ["Bergamot", "White musk", "Soft cedar"],
      ar: ["برغموت", "مسك أبيض", "أرز ناعم"],
    },
    images: [
      "/products/calm-1.svg",
      "/products/calm-2.svg",
      "/products/calm-3.svg",
      "/products/calm-4.svg",
      "/products/calm-5.svg",
    ],
    variants: [
      variant("calm-100", "100ml", 100, 18, true),
      variant("calm-10", "10ml", 10, 4.5),
    ],
    featured: true,
  },
  {
    slug: "nivran-noir",
    category: "perfume",
    audience: "men",
    concentration: "EDP",
    scentFamily: ["musk", "fresh"],
    name: { en: "NIVRAN Noir", ar: "نيفـران نوير" },
    subtitle: {
      en: "Deep wood and amber signature for evenings",
      ar: "توقيع خشبي وعنبر دافئ للمساء",
    },
    description: {
      en: "A richer profile with warm woods and musky depth made for confident evening wear.",
      ar: "تركيبة أغنى بنفحات خشبية وعمق مسكي لثقة المساء.",
    },
    notes: { en: ["Cardamom", "Amber wood", "Patchouli"], ar: ["هيل", "خشب عنبري", "باتشولي"] },
    images: ["/products/noir-1.svg", "/products/noir-2.svg", "/products/noir-3.svg"],
    variants: [variant("noir-100", "100ml", 100, 22, true), variant("noir-10", "10ml", 10, 5.2)],
  },
  {
    slug: "nivran-bloom",
    category: "perfume",
    audience: "women",
    concentration: "EDT",
    scentFamily: ["fresh", "citrus"],
    name: { en: "NIVRAN Bloom", ar: "نيفـران بلوم" },
    subtitle: { en: "Soft floral freshness with smooth musk", ar: "انتعاش زهري ناعم مع مسك لطيف" },
    description: {
      en: "A bright floral composition designed for graceful daytime wear.",
      ar: "تركيبة زهرية مشرقة للاستخدام النهاري الأنيق.",
    },
    notes: { en: ["Peony", "Orange blossom", "Clean musk"], ar: ["فاوانيا", "زهر البرتقال", "مسك نقي"] },
    images: ["/products/bloom-1.svg", "/products/bloom-2.svg"],
    variants: [variant("bloom-75", "75ml", 75, 19, true), variant("bloom-10", "10ml", 10, 4.8)],
  },
  {
    slug: "nivran-care-hand-gel",
    category: "hand-gel",
    audience: "unisex",
    concentration: "CARE",
    scentFamily: ["fresh", "citrus"],
    name: { en: "NIVRAN Care Hand Gel", ar: "نيفـران كير جل يدين" },
    subtitle: { en: "Quick-clean hand gel with light scent", ar: "جل يدين سريع بعطر خفيف" },
    description: { en: "Portable hand gel for everyday hygiene.", ar: "جل يدين محمول للنظافة اليومية." },
    notes: { en: ["Clean citrus"], ar: ["حمضيات نظيفة"] },
    images: ["/products/care-1.svg"],
    variants: [variant("care-60", "60ml", 60, 4.5, true)],
  },
];

export function defaultVariant(product: Product) {
  return product.variants.find((v) => v.isDefault) || product.variants[0];
}

export function minPrice(product: Product) {
  return Math.min(...product.variants.map((v) => v.priceJod));
}

export const featuredProduct = products.find((p) => p.featured) || products[0];

export const mainProductMessage = {
  en: "Our core line is perfume, with selected lifestyle categories expanding gradually.",
  ar: "خطنا الأساسي هو العطور، مع توسع تدريجي في فئات لايف ستايل مختارة.",
};

export const benefits = {
  en: [
    { title: "Perfume-first craft", body: "NIVRAN is built around signature perfumes with clean, wearable depth." },
    { title: "Scalable product architecture", body: "One fragrance page supports multiple size variants for clarity and SEO." },
    { title: "Built for Jordan", body: "Nationwide Jordan shipping with flat 3.5 JOD and responsive support." },
  ],
  ar: [
    { title: "خبرة عطور أولاً", body: "نيفـران مبنية حول عطور أساسية متوازنة وسهلة الارتداء يومياً." },
    { title: "هيكل منتجات قابل للتوسع", body: "صفحة العطر الواحدة تدعم أحجام متعددة لوضوح أفضل وتجربة بحث أقوى." },
    { title: "مصمم للأردن", body: "شحن لجميع مناطق الأردن برسوم ثابتة 3.5 دينار مع دعم سريع." },
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
