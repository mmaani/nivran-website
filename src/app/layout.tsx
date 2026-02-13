import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NIVRAN — Wear the calm.",
  description: "Clean, minimalist, unisex fragrance brand.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nivran.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
