import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

const swatches = [
  ["bg", "var(--bg)"],
  ["surface", "var(--surface)"],
  ["ink", "var(--ink)"],
  ["muted", "var(--muted)"],
  ["line", "var(--line)"],
  ["gold", "var(--gold)"],
] as const;

const section = { padding: 20 };

export default function StyleguidePage() {
  return (
    <main className="page" style={{ padding: 24, color: "var(--ink)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gap: 20 }}>
        <section className="surface" style={section}>
          <h1 className="en-headline" style={{ fontSize: 42, margin: 0 }}>NIVRAN / نيفـران — Styleguide</h1>
          <p style={{ color: "var(--muted)" }}>Wear the calm. / ارتدِ الهدوء</p>
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>1) Brand lock preview</h2>
          <Header />
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>2) Color swatches</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {swatches.map(([name, color]) => (
              <div key={name} className="surface" style={{ overflow: "hidden" }}>
                <div style={{ height: 72, background: color, borderBottom: "1px solid var(--line)" }} />
                <div style={{ padding: 10, fontSize: 14 }}>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ color: "var(--muted)" }}>{color}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>3) Typography scale</h2>
          <h1 className="en-headline" style={{ fontSize: 52, marginBottom: 8 }}>Heading H1</h1>
          <h2 className="en-headline" style={{ fontSize: 40, marginBottom: 8 }}>Heading H2</h2>
          <h3 className="en-headline" style={{ fontSize: 30 }}>Heading H3</h3>
          <p style={{ fontSize: 16 }}>Body text in Inter at 16px with generous line-height.</p>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Small text in Inter for UI hints and metadata.</p>
          <p className="arabic-text" style={{ fontSize: 34 }}>نيفـران — ارتدِ الهدوء</p>
          <p className="arabic-text" style={{ fontSize: 20 }}>تصميم هادئ ونظيف، عطور يونيسكس بإحساس منعش ومتوازن.</p>
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>4) Buttons</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>5) Inputs</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <Input placeholder="Normal input" />
            <Input placeholder="Disabled input" disabled />
            <Input placeholder="RTL-compatible spacing" dir="rtl" />
          </div>
        </section>

        <section className="surface" style={section}>
          <h2 className="en-headline" style={{ fontSize: 30 }}>6) Cards</h2>
          <Card className="quiet-shadow" style={{ maxWidth: 360, overflow: "hidden" }}>
            <div style={{ height: 180, background: "var(--bg)", borderBottom: "1px solid var(--line)" }} />
            <div style={{ padding: 14 }}>
              <h3 className="en-headline" style={{ fontSize: 28, marginTop: 0 }}>NIVRAN Eau de Parfum</h3>
              <p style={{ color: "var(--muted)" }}>Fresh, minimalist, unisex signature scent.</p>
              <p style={{ fontSize: 18 }}>21.50 JOD</p>
              <Button variant="secondary">Add to cart</Button>
            </div>
          </Card>
        </section>

        <section className="surface" style={section} dir="rtl">
          <h2 className="arabic-text" style={{ fontSize: 32 }}>7) معاينة RTL</h2>
          <nav className="arabic-text" style={{ display: "flex", gap: 18, marginBottom: 10 }}>
            <a href="#">المتجر</a>
            <a href="#">القصة</a>
            <a href="#">تواصل</a>
          </nav>
          <p className="arabic-text">هذا مثال سريع للتأكد من تباعد صحيح في الاتجاه من اليمين إلى اليسار بدون استخدام تموضع مطلق.</p>
          <Input placeholder="اكتب الاسم الكامل" className="arabic-text" />
        </section>

        <Footer />
      </div>
    </main>
  );
}
