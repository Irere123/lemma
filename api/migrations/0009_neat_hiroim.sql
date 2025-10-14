CREATE TABLE "brainos_newsletter_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"writer_id" text NOT NULL,
	"newsletter_name" text NOT NULL,
	"from_name" text NOT NULL,
	"logo_url" text,
	"brand_color" text DEFAULT '#000000',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "brainos_newsletter_settings_writer_id_unique" UNIQUE("writer_id")
);
--> statement-breakpoint
ALTER TABLE "brainos_subscribers" ADD COLUMN "writer_id" text;--> statement-breakpoint
ALTER TABLE "brainos_newsletter_settings" ADD CONSTRAINT "brainos_newsletter_settings_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "writer_newsletter_writer_id_idx" ON "brainos_newsletter_settings" USING btree ("writer_id");--> statement-breakpoint
CREATE INDEX "writer_newsletter_active_idx" ON "brainos_newsletter_settings" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "brainos_subscribers" ADD CONSTRAINT "brainos_subscribers_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "writer_id_idx" ON "brainos_subscribers" USING btree ("writer_id");--> statement-breakpoint
ALTER TABLE "brainos_subscribers" ADD CONSTRAINT "brainos_subscribers_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "brainos_subscribers" ADD CONSTRAINT "brainos_subscribers_token_unique" UNIQUE("token");