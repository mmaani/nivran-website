export default function FAQ({ params }: { params: { locale: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>FAQ</h1>
      <p style={{ opacity: 0.7 }}>Locale: {params.locale}</p>
      <p><strong>Q:</strong> Is NIVRAN unisex?</p>
      <p><strong>A:</strong> Yes — designed as a fresh, clean unisex fragrance.</p>
    </div>
  );
}
