export default async function AdminOrder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Order Details</h1>
      <p style={{ opacity: 0.7 }}>Order ID: {id || "unknown"}</p>
    </div>
  );
}
