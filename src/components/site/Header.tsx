export default function Header() {
  return (
    <header className="surface" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div className="en-headline" style={{ fontSize: 36, fontWeight: 600 }}>NIVRAN</div>
          <div className="goldline" style={{ width: "min(240px, 100%)" }} />
          <div className="arabic-text" style={{ fontSize: 26 }}>نيفـران</div>
        </div>

        <nav style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 14 }}>
          <a href="#">Shop</a>
          <a href="#">Story</a>
          <a href="#">Contact</a>
          <span aria-label="Cart">🛒</span>
        </nav>
      </div>
    </header>
  );
}
