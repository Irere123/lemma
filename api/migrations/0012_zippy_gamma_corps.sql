CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('NEWSLETTER', 'WELCOME', 'CONFIRMATION', 'TRANSACTIONAL', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."workspace_role" AS ENUM('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TABLE "brainos_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366f1',
	"writer_id" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "categories_writer_slug_unique" UNIQUE("writer_id","slug")
);
--> statement-breakpoint
CREATE TABLE "brainos_document_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"category_id" text NOT NULL,
	CONSTRAINT "doc_categories_unique" UNIQUE("document_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "brainos_document_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "doc_tags_unique" UNIQUE("document_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "brainos_email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" "template_type" DEFAULT 'CUSTOM',
	"subject" text,
	"html_content" text,
	"json_content" jsonb,
	"preview_text" text,
	"writer_id" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "templates_writer_slug_unique" UNIQUE("writer_id","slug")
);
--> statement-breakpoint
CREATE TABLE "brainos_open_events" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriber_id" text,
	"campaign_id" text,
	"opened_at" timestamp with time zone DEFAULT now(),
	"user_agent" text,
	"ip_address" "inet"
);
--> statement-breakpoint
CREATE TABLE "brainos_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"writer_id" text NOT NULL,
	"usage_count" varchar DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tags_writer_slug_unique" UNIQUE("writer_id","slug")
);
--> statement-breakpoint
CREATE TABLE "brainos_workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" DEFAULT 'VIEWER',
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "brainos_workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "brainos_workspace_members" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" DEFAULT 'VIEWER',
	"invited_by" text,
	"invited_at" timestamp DEFAULT now(),
	"joined_at" timestamp,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "workspace_members_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "brainos_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"logo_url" text,
	"domain" text,
	"owner_id" text NOT NULL,
	"settings" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "brainos_workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "document_id" text;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "status" "campaign_status" DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "total_sent" varchar DEFAULT '0';--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "total_opens" varchar DEFAULT '0';--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "total_clicks" varchar DEFAULT '0';--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "is_ab_test" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "parent_campaign_id" text;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "variant_name" text;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD COLUMN "variant_percentage" varchar;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "meta_title" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "meta_description" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "meta_keywords" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "canonical_url" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "og_image" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "reading_time" varchar;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "word_count" varchar;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "brainos_categories" ADD CONSTRAINT "brainos_categories_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_categories" ADD CONSTRAINT "brainos_document_categories_document_id_brainos_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brainos_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_categories" ADD CONSTRAINT "brainos_document_categories_category_id_brainos_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."brainos_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_tags" ADD CONSTRAINT "brainos_document_tags_document_id_brainos_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brainos_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_tags" ADD CONSTRAINT "brainos_document_tags_tag_id_brainos_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brainos_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_email_templates" ADD CONSTRAINT "brainos_email_templates_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_open_events" ADD CONSTRAINT "brainos_open_events_subscriber_id_brainos_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."brainos_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_open_events" ADD CONSTRAINT "brainos_open_events_campaign_id_brainos_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brainos_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_tags" ADD CONSTRAINT "brainos_tags_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspace_invites" ADD CONSTRAINT "brainos_workspace_invites_workspace_id_brainos_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."brainos_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspace_invites" ADD CONSTRAINT "brainos_workspace_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspace_members" ADD CONSTRAINT "brainos_workspace_members_workspace_id_brainos_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."brainos_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspace_members" ADD CONSTRAINT "brainos_workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspace_members" ADD CONSTRAINT "brainos_workspace_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_workspaces" ADD CONSTRAINT "brainos_workspaces_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_writer_id_idx" ON "brainos_categories" USING btree ("writer_id");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "brainos_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "doc_categories_doc_id_idx" ON "brainos_document_categories" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_categories_cat_id_idx" ON "brainos_document_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "doc_tags_doc_id_idx" ON "brainos_document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "doc_tags_tag_id_idx" ON "brainos_document_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "templates_writer_id_idx" ON "brainos_email_templates" USING btree ("writer_id");--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "brainos_email_templates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "templates_slug_idx" ON "brainos_email_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "open_sub_id_idx" ON "brainos_open_events" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "open_camp_id_idx" ON "brainos_open_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "tags_writer_id_idx" ON "brainos_tags" USING btree ("writer_id");--> statement-breakpoint
CREATE INDEX "tags_slug_idx" ON "brainos_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_id_idx" ON "brainos_workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_email_idx" ON "brainos_workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_invites_token_idx" ON "brainos_workspace_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "brainos_workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "brainos_workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspaces_owner_id_idx" ON "brainos_workspaces" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "workspaces_slug_idx" ON "brainos_workspaces" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workspaces_domain_idx" ON "brainos_workspaces" USING btree ("domain");--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD CONSTRAINT "brainos_campaigns_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_campaigns" ADD CONSTRAINT "brainos_campaigns_document_id_brainos_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brainos_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_user_id_idx" ON "brainos_campaigns" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "brainos_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_scheduled_at_idx" ON "brainos_campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "campaigns_parent_id_idx" ON "brainos_campaigns" USING btree ("parent_campaign_id");--> statement-breakpoint
CREATE INDEX "documents_featured_idx" ON "brainos_documents" USING btree ("is_featured");