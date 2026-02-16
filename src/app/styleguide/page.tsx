import type { Metadata } from "next";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

export const metadata: Metadata = {
  title: "NIVRAN Styleguide",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StyleguidePage() {
  return (
    <main className="page" style={{ padding: 24, color: "var(--ink)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 20 }}>
        <section className="surface" style={{ padding: 20 }}>
          <h1 className="en-headline" style={{ fontSize: 42, margin: 0 }}>
            NIVRAN / نيفـران — Styleguide
          </h1>
          <p style={{ color: "var(--muted)", marginBottom: 0 }}>
            Internal preview page for layout primitives and brand visual consistency.
          </p>
        </section>

        <section className="surface" style={{ padding: 20 }}>
          <Header />
        </section>

        <Footer />
      </div>
    </main>
  );
}
