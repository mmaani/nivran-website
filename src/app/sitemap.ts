import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com";
  return [
    { url: `${base}/en`, lastModified: new Date() },
    { url: `${base}/en/story`, lastModified: new Date() },
    { url: `${base}/en/product`, lastModified: new Date() },
    { url: `${base}/en/contact`, lastModified: new Date() },
    { url: `${base}/en/faq`, lastModified: new Date() }
  ];
}
