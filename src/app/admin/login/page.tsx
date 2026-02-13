import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default function AdminLoginPage({ searchParams }: any) {
  const nextPath = typeof searchParams?.next === "string" ? searchParams.next : "/admin/orders";
  return <LoginClient nextPath={nextPath} />;
}
