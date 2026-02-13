export default function Cart({ params }: { params: { locale: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Cart</h1>
      <p style={{ opacity: 0.7 }}>Locale: {params.locale}</p>
    </div>
  );
}
