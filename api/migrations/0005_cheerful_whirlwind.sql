ALTER TABLE "brainos_documents" ADD COLUMN "markdown" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "banner_image" text;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "published_date" timestamp;--> statement-breakpoint
ALTER TABLE "brainos_documents" ADD COLUMN "send_as_newsletter" boolean DEFAULT false;