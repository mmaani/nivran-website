import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const rawBase = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com";
  // Normalize to https://www.nivran.com to match your primary domain
  const base = rawBase.replace(/^https?:\/\/(?!www\.)/, "https://www.");

  const now = new Date();

  const paths = [
    "",

    // EN
    "/en",
    "/en/story",
    "/en/product",
    "/en/contact",
    "/en/faq",

    // AR
    "/ar",
    "/ar/story",
    "/ar/product",
    "/ar/contact",
    "/ar/faq",
  ];

  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));
}
