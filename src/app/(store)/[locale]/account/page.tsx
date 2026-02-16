import AccountClient from "./AccountClient";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const safeLocale = locale === "ar" ? "ar" : "en";
  return <AccountClient locale={safeLocale} />;
}
