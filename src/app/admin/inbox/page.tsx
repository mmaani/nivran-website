// src/app/admin/inbox/page.tsx
import RequireAdmin from "../_components/RequireAdmin";
import InboxClient from "./InboxClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function AdminInboxPage() {
  return (
    <RequireAdmin>
      <InboxClient />
    </RequireAdmin>
  );
}
