import type { Locale } from "@/lib/locale";

export type HomeCopy = {
  hero: string;
  sub: string;
  explore: string;
  checkout: string;
  story: string;
  why: string;
  proof: string;
  newsletter: string;
  email: string;
  join: string;
  quick: string;
  categories: string;
  editorialCategories: string;
  featuredProducts: string;
  catalog: string;
  viewAllCategories: string;
  factsControls: string;
  trail: string;
  scentTrail: string;
  campaign: string;
  campaignHint: string;
  madeJordan: string;
  madeJordanBody: string;
  edpFocus: string;
  edpFocusBody: string;
  fastDelivery: string;
  fastDeliveryBody: string;
  premiumAccess: string;
  premiumAccessBody: string;
  cleanLineup: string;
  cleanLineupBody: string;
  perfumeDesc: string;
  creamDesc: string;
  handGelDesc: string;
};

const en: HomeCopy = {
  hero: "Wear the calm.",
  sub: "Elegant fragrance and body care — crafted for modern daily wear in Jordan.",
  explore: "Explore the scent",
  checkout: "Start checkout",
  story: "Read our story",
  why: "Why NIVRAN feels premium",
  proof: "Loved by customers",
  newsletter: "Members-only launch offers",
  email: "Your email",
  join: "Join now",
  quick: "Quick facts",
  categories: "Categories",
  editorialCategories: "Editorial categories",
  featuredProducts: "Featured products",
  catalog: "Browse catalog",
  viewAllCategories: "View all categories",
  factsControls: "Quick facts controls",
  trail: "Scent trail",
  scentTrail: "Scent trail",
  campaign: "Members-only launch offers — calm luxury, early access.",
  campaignHint: "Free shipping threshold available on qualifying orders.",
  madeJordan: "Made in Jordan",
  madeJordanBody: "Crafted and fulfilled locally",
  edpFocus: "EDP Focus",
  edpFocusBody: "Balanced for lasting presence",
  fastDelivery: "Fast delivery",
  fastDeliveryBody: "Amman + nationwide shipping",
  premiumAccess: "Accessible premium",
  premiumAccessBody: "Perfume starts from 15 JOD",
  cleanLineup: "Clean lineup",
  cleanLineupBody: "Perfume + care essentials",
  perfumeDesc: "Signature scent collection",
  creamDesc: "Daily skin comfort, minimalist ritual",
  handGelDesc: "Clean care on the go",
};

const ar: HomeCopy = {
  hero: "ارتدِ الهدوء.",
  sub: "عطور وعناية أنيقة — مصممة للاستخدام اليومي العصري في الأردن.",
  explore: "استكشف العطر",
  checkout: "ابدأ الدفع",
  story: "اقرأ قصتنا",
  why: "لماذا تبدو نيفـران فاخرة",
  proof: "آراء العملاء",
  newsletter: "عروض حصرية للمشتركين",
  email: "بريدك الإلكتروني",
  join: "اشترك الآن",
  quick: "معلومات سريعة",
  categories: "الفئات",
  editorialCategories: "فئات مختارة",
  featuredProducts: "منتجات مختارة",
  catalog: "تصفح المنتجات",
  viewAllCategories: "عرض جميع الفئات",
  factsControls: "خيارات الحقائق السريعة",
  trail: "أثر العطر",
  scentTrail: "أثر العطر",
  campaign: "عروض الإطلاق للأعضاء — وصول مبكر وهدوء فاخر.",
  campaignHint: "شحن مجاني عند حد أدنى للطلبات المؤهلة.",
  madeJordan: "صُنع في الأردن",
  madeJordanBody: "تصنيع وتوصيل محلي",
  edpFocus: "تركيز EDP",
  edpFocusBody: "توازن وثبات",
  fastDelivery: "توصيل سريع",
  fastDeliveryBody: "عمّان وكافة المحافظات",
  premiumAccess: "فخامة بسعر قريب",
  premiumAccessBody: "العطر يبدأ من 15 د.أ",
  cleanLineup: "تشكيلة نظيفة",
  cleanLineupBody: "عطور + عناية أساسية",
  perfumeDesc: "مجموعة العطر الأساسية",
  creamDesc: "راحة يومية... بطقوس بسيطة",
  handGelDesc: "نظافة أنيقة أثناء التنقل",
};

export const HOME_COPY: Record<Locale, HomeCopy> = { en, ar };

export function getHomeCopy(locale: Locale): HomeCopy {
  return HOME_COPY[locale];
}
