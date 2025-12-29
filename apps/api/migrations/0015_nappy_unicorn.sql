CREATE TABLE "brainos_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brainos_document_likes" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "document_likes_unique" UNIQUE("document_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "brainos_comments" ADD CONSTRAINT "brainos_comments_document_id_brainos_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brainos_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_comments" ADD CONSTRAINT "brainos_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."brainos_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_likes" ADD CONSTRAINT "brainos_document_likes_document_id_brainos_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."brainos_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_document_likes" ADD CONSTRAINT "brainos_document_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_document_id_idx" ON "brainos_comments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "brainos_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "brainos_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_created_at_idx" ON "brainos_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "document_likes_document_id_idx" ON "brainos_document_likes" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_likes_user_id_idx" ON "brainos_document_likes" USING btree ("user_id");