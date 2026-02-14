import ProductCatalogClient from "./ProductCatalogClient";
import { products } from "@/lib/siteContent";

export default async function ProductCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";

  return <ProductCatalogClient locale={locale} initialProducts={products} />;
}
