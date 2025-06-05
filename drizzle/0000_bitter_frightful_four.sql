CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"resume_url" text NOT NULL,
	"summary_of_resume" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
