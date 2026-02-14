import type { Metadata } from "next";
import "./globals.css";
import { cairoArabic, inter, playfairDisplay } from "./ui/fonts";
import Script from "next/script";

export const metadata: Metadata = {
  title: "NIVRAN — Wear the calm.",
  description: "Clean, minimalist, unisex fragrance brand.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com"),
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cairoArabic.variable} ${playfairDisplay.variable}`}
    >
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-RSBL7QC85M"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-RSBL7QC85M');
          `}
        </Script>
      </head>

      <body>{children}</body>
    </html>
  );
}
