export default function Checkout({ params }: { params: { locale: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Checkout</h1>
      <p style={{ opacity: 0.7 }}>Locale: {params.locale}</p>
    </div>
  );
}
