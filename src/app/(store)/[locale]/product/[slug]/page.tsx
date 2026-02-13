export default function ProductPage({ params }: { params: { locale: string; slug: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Product</h1>
      <p style={{ opacity: 0.7 }}>Locale: {params.locale}</p>
      <p><strong>Slug:</strong> {params.slug}</p>
    </div>
  );
}
