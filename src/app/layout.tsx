import type { Metadata } from "next";
import "./globals.css";
import { cairoArabic, inter, playfairDisplay } from "./ui/fonts";

export const metadata: Metadata = {
  title: "NIVRAN — Wear the calm.",
  description: "Clean, minimalist, unisex fragrance brand.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nivran.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cairoArabic.variable} ${playfairDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}
