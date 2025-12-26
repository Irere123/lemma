CREATE TABLE "oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"refresh_token" text,
	"application_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_access_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "oauth_access_tokens_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "oauth_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"overview" text,
	"logo_url" text,
	"website" text,
	"install_url" text,
	"screenshots" text[] DEFAULT '{}'::text[] NOT NULL,
	"redirect_uris" text[] DEFAULT '{}'::text[] NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_public" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"status" text DEFAULT 'draft',
	CONSTRAINT "oauth_applications_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "oauth_authorization_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"application_id" text NOT NULL,
	"user_id" text NOT NULL,
	"scopes" text[] NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used" boolean DEFAULT false,
	"code_challenge" text,
	"code_challenge_method" text,
	CONSTRAINT "oauth_authorization_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."oauth_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."oauth_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_token_idx" ON "oauth_access_tokens" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens" USING btree ("refresh_token" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_application_id_idx" ON "oauth_access_tokens" USING btree ("application_id" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_access_tokens_user_id_idx" ON "oauth_access_tokens" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_applications_client_id_idx" ON "oauth_applications" USING btree ("client_id" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_applications_slug_idx" ON "oauth_applications" USING btree ("slug" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_code_idx" ON "oauth_authorization_codes" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_application_id_idx" ON "oauth_authorization_codes" USING btree ("application_id" text_ops);--> statement-breakpoint
CREATE INDEX "oauth_authorization_codes_user_id_idx" ON "oauth_authorization_codes" USING btree ("user_id" text_ops);