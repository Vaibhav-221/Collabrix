import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";

const dbDirectory = path.dirname(fileURLToPath(import.meta.url));
const seedOnly = process.argv.includes("--seed-only");

async function applySchema(client) {
  const schema = await fs.readFile(path.join(dbDirectory, "schema.sql"), "utf8");
  await client.query(schema);
  console.log("Database schema initialized.");
}

async function applySeed(client) {
  const seed = await fs.readFile(path.join(dbDirectory, "seed.sql"), "utf8");
  const existing = await client.query(
    `SELECT id, password_hash, full_name, student_id, role
     FROM users
     WHERE email = $1`,
    [env.professorSeed.email],
  );

  let passwordHash;
  if (existing.rows.length === 0) {
    passwordHash = await bcrypt.hash(env.professorSeed.password, 12);
    await client.query(seed, [
      env.professorSeed.email,
      passwordHash,
      env.professorSeed.name,
    ]);
  } else {
    const professor = existing.rows[0];
    const passwordMatches = await bcrypt.compare(
      env.professorSeed.password,
      professor.password_hash,
    );
    passwordHash = passwordMatches ? professor.password_hash : await bcrypt.hash(env.professorSeed.password, 12);

    const shouldUpdateName = professor.full_name !== env.professorSeed.name;
    const shouldUpdatePassword = !passwordMatches;
    const shouldUpdateRole = professor.role !== "professor";
    const shouldUpdateStudentId = professor.student_id !== null;

    if (shouldUpdateName || shouldUpdatePassword || shouldUpdateRole || shouldUpdateStudentId) {
      await client.query(
        `UPDATE users
         SET password_hash = $1,
             full_name = $2,
             student_id = NULL,
             role = 'professor',
             updated_at = CASE
                 WHEN password_hash IS DISTINCT FROM $1
                   OR full_name IS DISTINCT FROM $2
                   OR student_id IS NOT NULL
                   OR role IS DISTINCT FROM 'professor'
                 THEN CURRENT_TIMESTAMP
                 ELSE updated_at
             END
         WHERE id = $3`,
        [passwordHash, env.professorSeed.name, professor.id],
      );
    }
  }

  console.log("Seeded professor account is ready.");
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!seedOnly) {
      await applySchema(client);
    }
    await applySeed(client);

    const result = await client.query(
      "SELECT COUNT(*)::int AS count FROM users WHERE role = 'professor' AND email = $1",
      [env.professorSeed.email],
    );
    if (result.rows[0].count !== 1) {
      throw new Error("Seed verification found an unexpected professor account count");
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Failed to roll back database migration:", rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
});
