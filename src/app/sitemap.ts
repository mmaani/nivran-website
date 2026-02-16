import type { MetadataRoute } from "next";

const LOCALES = ["en", "ar"] as const;

const STORE_PATHS = [
  "",
  "/story",
  "/product",
  "/contact",
  "/faq",
  "/cart",
  "/checkout",
  "/account",
  "/privacy",
  "/returns",
  "/shipping",
  "/terms",
  "/compliance",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const rawBase = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com";
  const base = rawBase.replace(/^https?:\/\/(?!www\.)/, "https://www.");
  const now = new Date();

  const localizedPaths = LOCALES.flatMap((locale) =>
    STORE_PATHS.map((path) => `/${locale}${path}`)
  );

  const paths = ["", ...localizedPaths];

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
