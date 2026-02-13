export default function AdminOrder(props: any) {
  const id = props?.params?.id ?? "unknown";

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Order Details</h1>
      <p style={{ opacity: 0.7 }}>Order ID: {id}</p>
    </div>
  );
}
