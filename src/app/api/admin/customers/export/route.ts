import { requireAdmin } from "@/lib/guards";
import { fetchAdminCustomers, fetchAllAdminCustomers } from "@/lib/adminCustomers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function xmlEscape(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cell(v: string): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`;
}

function row(values: string[]): string {
  return `<Row>${values.map(cell).join("")}</Row>`;
}

function toInt(v: string | null, fallback: number): number {
  const n = Number(v || fallback);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export async function GET(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return new Response(JSON.stringify({ ok: false, error: auth.error }), { status: auth.status });

  const url = new URL(req.url);
  const pageSize = toInt(url.searchParams.get("pageSize"), 25);
  const scope = String(url.searchParams.get("scope") || "page").toLowerCase();
  const page = toInt(url.searchParams.get("page"), 1);

  const result = scope === "all" ? null : await fetchAdminCustomers(page, pageSize);
  const exportRows = scope === "all" ? await fetchAllAdminCustomers(100) : result?.rows ?? [];

  const headers = ["ID", "Email", "Name", "Phone", "Address", "Orders", "Total Spent (JOD)", "Last Order", "Created"];
  const dataRows = exportRows.map((r) => [
    String(r.id),
    r.email,
    r.full_name || "",
    r.phone || "",
    [r.address_line1, r.city, r.country].filter(Boolean).join(", "),
    String(r.orders_count),
    Number(r.total_spent || 0).toFixed(2),
    r.last_order_at ? new Date(r.last_order_at).toISOString() : "",
    new Date(r.created_at).toISOString(),
  ]);

  const worksheet = `
    <Worksheet ss:Name="Customers">
      <Table>
        <Column ss:Width="60"/>
        <Column ss:Width="220"/>
        <Column ss:Width="180"/>
        <Column ss:Width="120"/>
        <Column ss:Width="220"/>
        <Column ss:Width="80"/>
        <Column ss:Width="120"/>
        <Column ss:Width="180"/>
        <Column ss:Width="140"/>
        ${row(headers)}
        ${dataRows.map(row).join("\n")}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <FreezePanes/>
        <FrozenNoSplit/>
        <SplitHorizontal>1</SplitHorizontal>
        <TopRowBottomPane>1</TopRowBottomPane>
      </WorksheetOptions>
    </Worksheet>
  `;

  const xml = `<?xml version="1.0"?>
  <?mso-application progid="Excel.Sheet"?>
  <Workbook
    xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:html="http://www.w3.org/TR/REC-html40">
    <Styles>
      <Style ss:ID="Default" ss:Name="Normal">
        <Alignment ss:Vertical="Bottom"/>
        <Borders/>
        <Font ss:FontName="Calibri" ss:Size="11"/>
        <Interior/>
        <NumberFormat/>
        <Protection/>
      </Style>
      <Style ss:ID="Header">
        <Font ss:Bold="1"/>
        <Interior ss:Color="#F3EBDD" ss:Pattern="Solid"/>
      </Style>
    </Styles>
    ${worksheet.replace("<Row>", '<Row ss:StyleID="Header">')}
  </Workbook>`;

  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const filename = `NIVRAN_Customers_${timestamp}.xls`;

  return new Response(xml, {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
