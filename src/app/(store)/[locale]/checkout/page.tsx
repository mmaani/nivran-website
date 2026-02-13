export default function Checkout(props: any) {
  const locale = props?.params?.locale ?? "en";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Checkout</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>
      <p>Checkout UI + PayTabs flow goes here.</p>
    </div>
  );
}
