import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

export async function checkDb() {
  const r = await pool.query("SELECT NOW() as now");
  console.log("✅ DB connected:", r.rows[0].now);
}