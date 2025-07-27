CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brainos_campaign_links" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"url" text NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "brainos_campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"userId" text NOT NULL,
	"content" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "brainos_click_events" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriber_id" text,
	"link_id" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" "inet"
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "brainos_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"token" text NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now(),
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"is_confirmed" boolean DEFAULT false,
	"is_unsubscribed" boolean DEFAULT false,
	CONSTRAINT "sub_constraint" UNIQUE("email","token")
);
--> statement-breakpoint
CREATE TABLE "brainos_unsubscribe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"subscriber_id" text,
	"campaign_id" text,
	"unsubscribed_at" timestamp with time zone DEFAULT now(),
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_campaign_links" ADD CONSTRAINT "brainos_campaign_links_campaign_id_brainos_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brainos_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_click_events" ADD CONSTRAINT "brainos_click_events_subscriber_id_brainos_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."brainos_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_click_events" ADD CONSTRAINT "brainos_click_events_link_id_brainos_campaign_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."brainos_campaign_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_unsubscribe_events" ADD CONSTRAINT "brainos_unsubscribe_events_subscriber_id_brainos_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."brainos_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brainos_unsubscribe_events" ADD CONSTRAINT "brainos_unsubscribe_events_campaign_id_brainos_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brainos_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "camp_id_idx" ON "brainos_campaign_links" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "sub_id_idx" ON "brainos_click_events" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "camp_ev_id_idx" ON "brainos_click_events" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "email_idx" ON "brainos_subscribers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "token_idx" ON "brainos_subscribers" USING btree ("token");--> statement-breakpoint
CREATE INDEX "confirmed_idx" ON "brainos_subscribers" USING btree ("is_confirmed");--> statement-breakpoint
CREATE INDEX "sub_rel_id_idx" ON "brainos_unsubscribe_events" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "camp_rel_id_idx" ON "brainos_unsubscribe_events" USING btree ("campaign_id");