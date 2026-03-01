const { Client } = require("pg");

const cartId = process.argv[2];
if (!cartId) {
  console.error("Usage: node scripts/fix-order-status.js <cartId>");
  process.exit(1);
}

const SQL = `
update orders
   set status = case
                  when status = 'PAID'
                   and coalesce(paytabs_response_status,'') <> 'A'
                   and coalesce(inventory_committed_at, null) is null
                  then 'FAILED'
                  else status
                end,
       updated_at = now()
 where cart_id = $1
 returning cart_id, status, paytabs_response_status, paytabs_response_message, inventory_committed_at, updated_at
`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await c.connect();
    const r = await c.query(SQL, [cartId]);
    console.table(r.rows);
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
