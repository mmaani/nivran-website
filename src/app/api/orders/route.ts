import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureCatalogTables } from "@/lib/catalog";
import { ensureIdentityTables, getCustomerByEmail, createCustomer, createCustomerSession, createSessionToken, getCustomerIdFromRequest } from "@/lib/identity";
import { upsertCart } from "@/lib/cartStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeCartId() {
  return `NIVRAN-${Date.now()}`;
}

export async function POST(req: Request) {
  await ensureCatalogTables();
  await ensureIdentityTables();

  const body = await req.json().catch(() => ({}));

  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems
    .map((i: any) => ({
      slug: String(i?.slug || "").trim(),
      qty: Math.max(1, Number(i?.qty || 1)),
    }))
    .filter((i: any) => i.slug);

  if (!items.length) {
    return NextResponse.json({ ok: false, error: "Cart is empty." }, { status: 400 });
  }

  const customer = body?.customer || {};
  const shipping = body?.shipping || {};
  const createAccount = !!body?.createAccount;
  const paymentMethod = String(body?.paymentMethod || "PAYTABS"); // PAYTABS | COD

  const fullName = String(customer?.fullName || "").trim();
  const email = String(customer?.email || "").trim().toLowerCase();
  const phone = String(customer?.phone || "").trim();

  const addressLine1 = String(shipping?.addressLine1 || "").trim();
  const city = String(shipping?.city || "").trim();
  const country = String(shipping?.country || "").trim() || "Jordan";

  if (!fullName || !email || !phone || !addressLine1) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (name, email, phone, address)." },
      { status: 400 }
    );
  }

  // Compute prices from DB (don’t trust client)
  const slugs = Array.from(new Set(items.map((i: any) => i.slug)));
  const pr = await db.query<{ slug: string; name_en: string; name_ar: string; price_jod: string }>(
    `select slug, name_en, name_ar, price_jod::text as price_jod
       from products
      where slug = any($1::text[]) and is_active=true`,
    [slugs]
  );

  const bySlug = new Map(pr.rows.map((p) => [p.slug, p]));
  const normalized = items.map((i: any) => {
    const p = bySlug.get(i.slug);
    if (!p) throw new Error(`Unknown product slug: ${i.slug}`);
    const price = Number(p.price_jod || 0);
    return {
      slug: i.slug,
      name: p.name_en || i.slug,
      priceJod: price,
      qty: i.qty,
      lineTotal: price * i.qty,
    };
  });

  const subtotal = normalized.reduce((s: number, x: any) => s + x.lineTotal, 0);
  const shippingJod = 3.5;
  const amountJod = subtotal + shippingJod;

  // Try to get existing logged-in customer id
  let customerId = await getCustomerIdFromRequest(req);

  // If not logged in and consent is checked, ONLY auto-create if email is not registered
  // (Never auto-login an existing email—security)
  let createdSessionToken: string | null = null;

  if (!customerId && createAccount) {
    const existing = await getCustomerByEmail(email);
    if (!existing) {
      const randomPassword = createSessionToken(); // strong random, user can reset later
      const created = await createCustomer({
        email,
        fullName,
        password: randomPassword,
        phone,
        addressLine1,
        city,
        country,
      });
      customerId = created.id;

      createdSessionToken = createSessionToken();
      await createCustomerSession(customerId, createdSessionToken);

      // persist cart server-side
      await upsertCart(customerId, normalized.map((x: any) => ({
        slug: x.slug, name: x.name, priceJod: x.priceJod, qty: x.qty
      })));
    }
  }

  const cartId = makeCartId();

  // Insert order (your DB likely already has items jsonb; keep this insert consistent with your existing handler)
  await db.query(
    `insert into orders
      (cart_id, status, amount_jod, currency, customer, shipping, payment_method, paytabs_ref, paytabs_status, customer_id)
     values
      ($1, $2, $3, 'JOD', $4::jsonb, $5::jsonb, $6, null, null, $7)`,
    [
      cartId,
      paymentMethod === "COD" ? "PENDING" : "PENDING_PAYMENT",
      amountJod,
      JSON.stringify({ fullName, email, phone }),
      JSON.stringify({ addressLine1, city, country, shippingJod }),
      paymentMethod,
      customerId,
    ]
  );

  const res = NextResponse.json({ ok: true, cartId, amountJod });

  if (createdSessionToken) {
    res.cookies.set("nivran_customer_session", createdSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
