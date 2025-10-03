CREATE INDEX "documents_user_id_idx" ON "brainos_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "brainos_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_type_idx" ON "brainos_documents" USING btree ("type");--> statement-breakpoint
CREATE INDEX "documents_created_at_idx" ON "brainos_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "documents_user_status_type_idx" ON "brainos_documents" USING btree ("user_id","status","type");