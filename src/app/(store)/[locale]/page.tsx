export default function Home({ params }: { params: { locale: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>NIVRAN</h1>
      <p style={{ opacity: 0.7 }}>Unisex • fresh • clean minimalist — “Wear the calm.”</p>
      <p><strong>Locale:</strong> {params.locale}</p>
    </div>
  );
}
