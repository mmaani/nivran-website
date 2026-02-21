"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/app/admin/_components/adminClient";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInt(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

type Delta = {
  slug: string;
  qty: number;
  current: number | null;
  after: number | null;
};

type Row = {
  id: number;
  cart_id: string;
  status: string;
  payment_method: string;
  created_at: string;
  inventory_committed_at: string | null;
  deltas: Delta[];
};

type GetResponse = {
  ok?: boolean;
  error?: string;
  totalPending?: number;
  rows?: unknown;
};

type PostOneResponse = { ok?: boolean; error?: string; committed?: boolean; id?: number };

type PostAllResponse = {
  ok?: boolean;
  error?: string;
  results?: unknown;
};

function normalizeRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((r): Row | null => {
      if (!isRecord(r)) return null;
      const deltasRaw = r["deltas"];
      const deltas: Delta[] = Array.isArray(deltasRaw)
        ? deltasRaw
            .map((d): Delta | null => {
              if (!isRecord(d)) return null;
              const slug = typeof d["slug"] === "string" ? d["slug"] : "";
              if (!slug) return null;
              const qty = Math.max(1, toInt(d["qty"]) || 1);
              const current = typeof d["current"] === "number" && Number.isFinite(d["current"]) ? d["current"] : d["current"] == null ? null : toInt(d["current"]);
              const after = typeof d["after"] === "number" && Number.isFinite(d["after"]) ? d["after"] : d["after"] == null ? null : toInt(d["after"]);
              return { slug, qty, current, after };
            })
            .filter((x): x is Delta => x !== null)
        : [];

      return {
        id: toInt(r["id"]),
        cart_id: typeof r["cart_id"] === "string" ? r["cart_id"] : "",
        status: typeof r["status"] === "string" ? r["status"] : "",
        payment_method: typeof r["payment_method"] === "string" ? r["payment_method"] : "",
        created_at: typeof r["created_at"] === "string" ? r["created_at"] : "",
        inventory_committed_at: typeof r["inventory_committed_at"] === "string" ? r["inventory_committed_at"] : null,
        deltas,
      };
    })
    .filter((x): x is Row => x !== null && x.id > 0 && !!x.cart_id);
}

export default function InventoryClient({ lang }: { lang: "en" | "ar" }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPending, setTotalPending] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const L = useMemo(() => {
    if (lang === "ar") {
      return {
        title: "مطابقة المخزون",
        subtitle: "طلبات مدفوعة لم يتم خصم المخزون لها بعد.",
        refresh: "تحديث",
        commitAll: "تنفيذ للكل",
        commit: "تنفيذ",
        open: "فتح",
        id: "ID",
        cart: "السلة",
        status: "الحالة",
        created: "التاريخ",
        deltas: "التغييرات",
        stock: "المخزون",
        none: "لا يوجد",
        ok: "تم",
      };
    }
    return {
      title: "Inventory reconciliation",
      subtitle: "Paid orders that have not committed inventory yet.",
      refresh: "Refresh",
      commitAll: "Commit all",
      commit: "Commit",
      open: "Open",
      id: "ID",
      cart: "Cart",
      status: "Status",
      created: "Created",
      deltas: "Deltas",
      stock: "Stock",
      none: "None",
      ok: "OK",
    };
  }, [lang]);

  async function load() {
    setErr(null);
    setBusy(true);
    try {
      const res = await adminFetch("/api/admin/inventory/reconcile?limit=60", { method: "GET" });
      const raw: unknown = await res.json().catch(() => null);
      const data: GetResponse = isRecord(raw) ? (raw as GetResponse) : {};
      if (!res.ok || data.ok !== true) throw new Error(data.error || "Load failed");

      setTotalPending(typeof data.totalPending === "number" ? data.totalPending : toInt(data.totalPending));
      setRows(normalizeRows(data.rows));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || "");
      setErr(msg || "Error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch(() => null);
  }, []);

  async function commitOne(id: number) {
    setErr(null);
    setBusyId(id);
    try {
      const res = await adminFetch("/api/admin/inventory/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
      const raw: unknown = await res.json().catch(() => null);
      const data: PostOneResponse = isRecord(raw) ? (raw as PostOneResponse) : {};
      if (!res.ok || data.ok !== true) throw new Error(data.error || "Commit failed");

      // Remove row if committed (or if already committed)
      setRows((prev) => prev.filter((r) => r.id !== id));
      setTotalPending((p) => Math.max(0, p - 1));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || "");
      setErr(msg || "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function commitAll() {
    setErr(null);
    setBusy(true);
    try {
      const res = await adminFetch("/api/admin/inventory/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "ALL", limit: 25 }),
      });
      const raw: unknown = await res.json().catch(() => null);
      const data: PostAllResponse = isRecord(raw) ? (raw as PostAllResponse) : {};
      if (!res.ok || data.ok !== true) throw new Error(data.error || "Commit all failed");

      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || "");
      setErr(msg || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-grid">
      <div className="admin-card" style={{ display: "grid", gap: 10 }}>
        <div className="admin-row" style={{ justifyContent: "space-between" }}>
          <div>
            <p className="admin-kicker" style={{ marginBottom: 6 }}>{L.title}</p>
            <p className="admin-muted">{L.subtitle}</p>
          </div>

          <div className="admin-row" style={{ justifyContent: "flex-end" }}>
            <span className="admin-pill admin-pill-title">{totalPending}</span>
            <button className="btn" type="button" onClick={() => load()} disabled={busy}>
              {L.refresh}
            </button>
            <button className="btn btn-primary" type="button" onClick={() => commitAll()} disabled={busy || rows.length === 0}>
              {L.commitAll}
            </button>
          </div>
        </div>

        {err ? <div style={{ color: "crimson", fontWeight: 700 }}>{err}</div> : null}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{L.id}</th>
              <th>{L.cart}</th>
              <th>{L.status}</th>
              <th>{L.created}</th>
              <th>{L.deltas}</th>
              <th>{L.stock}</th>
              <th>{L.open}</th>
              <th>{L.commit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, opacity: 0.7 }}>{L.none}</td>
              </tr>
            ) : (
              rows.map((r) => {
                const badgeStyle = (ok: boolean) => ({
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "2px 8px",
                  borderRadius: 999,
                  border: `1px solid ${ok ? "rgba(20,20,20,.12)" : "rgba(210,65,65,.25)"}`,
                  background: ok ? "rgba(251,248,243,.9)" : "rgba(255,242,242,.9)",
                  fontWeight: 800,
                  fontSize: 12,
                });

                const hasMissing = r.deltas.some((d) => d.current == null);

                return (
                  <tr key={r.id}>
                    <td className="ltr">{r.id}</td>
                    <td className="ltr">{r.cart_id}</td>
                    <td className="ltr">
                      {r.status} / {r.payment_method}
                      {hasMissing ? <span style={{ marginInlineStart: 8, ...badgeStyle(false) }}>Missing SKU</span> : null}
                    </td>
                    <td style={{ fontSize: 12, opacity: 0.85 }}>{new Date(r.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        {r.deltas.length ? r.deltas.map((d) => (
                          <div key={`${r.id}-${d.slug}`} className="ltr" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="badge" style={{ fontWeight: 800 }}>{d.slug}</span>
                            <span style={{ ...badgeStyle(true) }}>- {d.qty}</span>
                          </div>
                        )) : <span style={{ opacity: 0.7 }}>{L.none}</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "grid", gap: 6 }}>
                        {r.deltas.length ? r.deltas.map((d) => (
                          <div key={`${r.id}-${d.slug}-stock`} className="ltr" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ ...badgeStyle(d.current != null) }}>
                              {d.current == null ? "?" : d.current}
                            </span>
                            <span style={{ opacity: 0.75 }}>→</span>
                            <span style={{ ...badgeStyle(d.after != null) }}>
                              {d.after == null ? "?" : d.after}
                            </span>
                          </div>
                        )) : <span style={{ opacity: 0.7 }}>{L.none}</span>}
                      </div>
                    </td>
                    <td>
                      <Link className="btn" href={`/admin/orders/${r.id}`}>
                        {L.open}
                      </Link>
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        type="button"
                        onClick={() => commitOne(r.id)}
                        disabled={busyId === r.id || busy}
                      >
                        {busyId === r.id ? "…" : L.commit}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
