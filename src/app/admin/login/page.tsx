import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

type SearchParams = {
  next?: string;
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolved = (await searchParams) || {};
  const nextPath = typeof resolved?.next === "string" ? resolved.next : "/admin";
  return <LoginClient nextPath={nextPath} />;
}
