CREATE TYPE "public"."bug_source" AS ENUM('web', 'agent');--> statement-breakpoint
CREATE TYPE "public"."bug_status" AS ENUM('Open', 'In Progress', 'Resolved', 'Closed');--> statement-breakpoint
CREATE TYPE "public"."bug_type" AS ENUM('Functional', 'Security', 'Aesthetic');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('Critical', 'High', 'Medium', 'Low');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_id" text NOT NULL,
	"data" "bytea" NOT NULL,
	"mimetype" text NOT NULL,
	"filename" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bugs" (
	"id" text PRIMARY KEY NOT NULL,
	"number" serial NOT NULL,
	"project_id" text NOT NULL,
	"feature_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"steps_to_reproduce" text NOT NULL,
	"bug_type" "bug_type" NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "bug_status" DEFAULT 'Open' NOT NULL,
	"reporter" text NOT NULL,
	"environment" text,
	"source" "bug_source" DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bugs_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"bug_id" text NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "features" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_bug_id_bugs_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_bug_id_bugs_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "features" ADD CONSTRAINT "features_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_bug_idx" ON "attachments" USING btree ("bug_id");--> statement-breakpoint
CREATE INDEX "bugs_project_idx" ON "bugs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bugs_feature_idx" ON "bugs" USING btree ("feature_id");--> statement-breakpoint
CREATE INDEX "comments_bug_idx" ON "comments" USING btree ("bug_id");--> statement-breakpoint
CREATE UNIQUE INDEX "features_project_name_idx" ON "features" USING btree ("project_id","name");