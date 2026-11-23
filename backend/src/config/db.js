import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

export const pool = new Pool({
  host: env.postgres.host,
  port: env.postgres.port,
  database: env.postgres.database,
  user: env.postgres.user,
  password: env.postgres.password,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export async function query(text, parameters) {
  return pool.query(text, parameters);
}

export async function checkDatabaseConnection() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0]?.ok === 1;
}
