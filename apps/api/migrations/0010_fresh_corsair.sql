ALTER TABLE "brainos_documents" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD CONSTRAINT "documents_slug_unique" UNIQUE("slug");