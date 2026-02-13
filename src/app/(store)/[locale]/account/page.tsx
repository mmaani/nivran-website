import AccountClient from "./AccountClient";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = raw === "ar" ? "ar" : "en";

  return (
    <div style={{ padding: "1rem 0" }}>
      <AccountClient locale={locale} />
    </div>
  );
}
