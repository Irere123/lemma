ALTER TABLE "accounts" RENAME TO "account";--> statement-breakpoint
ALTER TABLE "sessions" RENAME TO "session";--> statement-breakpoint
ALTER TABLE "users" RENAME TO "user";--> statement-breakpoint
ALTER TABLE "verifications" RENAME TO "verification";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "sessions_token_unique";--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "accounts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_api_user_fkey";
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_writer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "comments" DROP CONSTRAINT "comments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "document_likes" DROP CONSTRAINT "document_likes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP CONSTRAINT "documents_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "newsletter_settings" DROP CONSTRAINT "newsletter_settings_writer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" DROP CONSTRAINT "oauth_access_tokens_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "oauth_applications" DROP CONSTRAINT "oauth_applications_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" DROP CONSTRAINT "oauth_authorization_codes_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "sessions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscribers" DROP CONSTRAINT "subscribers_writer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_writer_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_api_user_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_likes" ADD CONSTRAINT "document_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_settings" ADD CONSTRAINT "newsletter_settings_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_applications" ADD CONSTRAINT "oauth_applications_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_writer_id_user_id_fk" FOREIGN KEY ("writer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");