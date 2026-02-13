export default function Cart(props: any) {
  const locale = props?.params?.locale ?? "en";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Cart</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>
    </div>
  );
}
