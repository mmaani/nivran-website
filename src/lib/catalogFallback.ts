import "server-only";
import { categoryLabels, products as staticProducts, type Locale } from "@/lib/siteContent";

export type CatalogFallbackRow = {
  id: number;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  price_jod: string;
  min_variant_price_jod: string;
  default_variant_id: number | null;
  default_variant_label: string | null;
  default_variant_price_jod: string;
  category_key: string;
  inventory_qty: number;
  image_id: null;
  promo_type: null;
  promo_value: null;
  discounted_price_jod: null;
  wear_times: string[];
  seasons: string[];
  audiences: string[];
  promo_min_order_jod: number | null;
  promo_eligible: boolean;
};

export function syntheticVariantId(slug: string, index = 0): number {
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) % 100000;
  return 10000 + hash + index;
}

export function fallbackCategories() {
  return Object.entries(categoryLabels).map(([key, labels], index) => ({
    key,
    name_en: labels.en,
    name_ar: labels.ar,
    is_active: true,
    is_promoted: false,
    sort_order: index,
  }));
}

export function fallbackCatalogRows(): CatalogFallbackRow[] {
  return staticProducts.map((p, index) => {
    const defaultVariant = p.variants?.find((v) => v.isDefault) || p.variants?.[0] || null;
    const minVariantPrice = (p.variants || []).reduce(
      (min, v) => Math.min(min, Number(v.priceJod || 0)),
      Number.POSITIVE_INFINITY
    );

    return {
      id: index + 1,
      slug: p.slug,
      name_en: p.name.en,
      name_ar: p.name.ar,
      description_en: p.description.en,
      description_ar: p.description.ar,
      price_jod: String(p.priceJod),
      min_variant_price_jod: Number.isFinite(minVariantPrice) ? String(minVariantPrice) : String(p.priceJod),
      default_variant_id: defaultVariant ? syntheticVariantId(p.slug) : null,
      default_variant_label: defaultVariant?.sizeLabel ?? null,
      default_variant_price_jod: String(defaultVariant?.priceJod ?? p.priceJod),
      category_key: p.category,
      inventory_qty: 99,
      image_id: null,
      promo_type: null,
      promo_value: null,
      discounted_price_jod: null,
      wear_times: [],
      seasons: [],
      audiences: [p.audience],
      promo_min_order_jod: null,
      promo_eligible: false,
    };
  });
}

export function fallbackProductBySlug(slug: string) {
  return staticProducts.find((item) => item.slug === slug) || null;
}

export function localizedName(value: { en: string; ar: string }, locale: Locale): string {
  return locale === "ar" ? value.ar : value.en;
}
