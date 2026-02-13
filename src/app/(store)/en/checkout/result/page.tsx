export default async function ResultPage({ searchParams }: any) {
  const cartId = String(searchParams?.cart_id || "");
  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 8 }}>Payment status</h1>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        If you completed payment, we will confirm your order once PayTabs sends the server callback.
      </p>
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div><b>Cart ID:</b> {cartId || "—"}</div>
        <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>
          You can close this page. You’ll receive confirmation once processed.
        </div>
      </div>
    </div>
  );
}
