"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Shows full error in the server console + browser console
    console.error("ADMIN SEGMENT ERROR:", error);
  }, [error]);

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Admin error</h1>

      <p style={{ opacity: 0.8, marginTop: 0 }}>
        This page failed to render due to a server error.
      </p>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 700 }}>Message</div>
        <pre style={{ whiteSpace: "pre-wrap" }}>{error.message || "(no message)"}</pre>
      </div>

      {error.digest ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>Digest</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{error.digest}</pre>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button className="btn" type="button" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}