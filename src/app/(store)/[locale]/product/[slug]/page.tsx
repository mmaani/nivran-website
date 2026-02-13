export default function ProductPage(props: any) {
  const locale = props?.params?.locale ?? "en";
  const slug = props?.params?.slug ?? "unknown";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Product</h1>
      <p style={{ opacity: 0.7 }}>Locale: {locale}</p>
      <p><strong>Slug:</strong> {slug}</p>
    </div>
  );
}
