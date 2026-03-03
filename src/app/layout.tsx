import type { Metadata } from "next";
import "./globals.css";
import { cairoArabic, inter, playfairDisplay } from "./ui/fonts";
import Script from "next/script";

export const metadata: Metadata = {
  title: "NIVRAN — Wear the calm.",
  description: "Clean, minimalist, unisex fragrance and body care brand.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.nivran.com"),
  icons: {
    icon: [
      { url: "/brand/favicon.ico" },
      { url: "/brand/favicon-96x96.png", type: "image/png", sizes: "96x96" },
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: [{ url: "/brand/favicon.ico" }],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/brand/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.VERCEL_ENV === "production";

  return (
    <html
      lang="en"
      className={`${inter.variable} ${cairoArabic.variable} ${playfairDisplay.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="NIVRAN" />

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

      <body>
        {children}
        {isProd ? <Script src="/_vercel/insights/script.js" strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
