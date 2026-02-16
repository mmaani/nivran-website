import AccountClient from "./AccountClient";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { CUSTOMER_SESSION_COOKIE, ensureIdentityTables, sha256Hex } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "ar" ? "ar" : "en";

  await ensureIdentityTables();

  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value || "";
  if (!token) redirect(`/${locale}/account/login`);

  const tokenHash = sha256Hex(token);
  const r = await db.query<{ customer_id: number }>(
    `select customer_id
       from customer_sessions
      where token_hash=$1
        and revoked_at is null
        and expires_at > now()
      limit 1`,
    [tokenHash]
  );

  if (!r.rows[0]?.customer_id) redirect(`/${locale}/account/login`);

  return <AccountClient locale={locale} />;
}
