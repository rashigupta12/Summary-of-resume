import * as schema from "./schema";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, {
  schema,
  logger: !isProduction,
});
