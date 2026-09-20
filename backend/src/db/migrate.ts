import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "./pool";

async function migrate(): Promise<void> {
  const schemaPath = path.join(
    process.cwd(),
    "src",
    "db",
    "schema.sql"
  );

  const schema = await fs.readFile(schemaPath, "utf8");

  console.log("Running database migration...");

  await pool.query(schema);

  console.log("Database migration completed successfully.");

  await pool.end();
}

migrate().catch(async (error) => {
  console.error("Database migration failed:");
  console.error(error);

  await pool.end();

  process.exit(1);
});