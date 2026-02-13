export default function AdminOrder({ params }: { params: { id: string } }) {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Order Details</h1>
      <p style={{ opacity: 0.7 }}>Order ID: {params.id}</p>
    </div>
  );
}
