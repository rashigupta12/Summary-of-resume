import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  name: text("name").notNull(), // e.g. "New York"
  resumeUrl: text("resume_url").notNull(), // URL to the resume file
  summaryOfResume: text("summary_of_resume").notNull(), // Summary of the resume
  structuredData: jsonb("structured_data"), // JSON structured data from resume
  createdAt: timestamp("created_at").defaultNow().notNull(),
});