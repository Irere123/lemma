DROP INDEX "documents_type_idx";--> statement-breakpoint
DROP INDEX "documents_user_status_type_idx";--> statement-breakpoint
CREATE INDEX "documents_user_status_idx" ON "brainos_documents" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "brainos_documents" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."document_type";