import { cookies } from "next/headers";

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  const token = store.get("admin_token")?.value || store.get("nivran_admin_token")?.value || "";
  const expected = process.env.ADMIN_TOKEN || "";
  return Boolean(expected && token && token.trim() === expected.trim());
}
