import { redirect } from "next/navigation";

export default async function LegacyReturnsPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";
  redirect(`/${locale}/returns`);
}
