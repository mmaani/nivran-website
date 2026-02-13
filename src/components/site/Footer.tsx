export default function Footer() {
  return (
    <footer style={{ marginTop: 32, padding: "24px 8px", borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: 14 }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>nivran.com</div>
        <div style={{ display: "flex", gap: 14 }}><a href="#">Instagram</a><a href="#">TikTok</a><a href="#">X</a></div>
        <div style={{ display: "flex", gap: 14 }}><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Shipping</a></div>
      </div>
    </footer>
  );
}
