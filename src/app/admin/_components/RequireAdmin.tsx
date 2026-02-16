// src/app/admin/_components/RequireAdmin.tsx
import React from "react";
import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-page";

export async function RequireAdmin({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthed();
  if (!authed) redirect("/admin/login");
  return <>{children}</>;
}

export default RequireAdmin;
