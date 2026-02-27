import { readAdminSessionFromCookies } from "@/lib/adminSession";

export async function isAdminAuthed(): Promise<boolean> {
  const session = await readAdminSessionFromCookies();
  return session?.role === "admin";
}

export async function getAdminRole(): Promise<"admin" | "sales" | null> {
  const session = await readAdminSessionFromCookies();
  return session?.role || null;
}
