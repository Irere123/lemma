CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_encrypted` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`user_id` text NOT NULL,
	`key_hash` text,
	`scopes` text DEFAULT '[]' NOT NULL,
	`last_used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `api_keys_key_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `api_keys_user_id_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `campaign_links` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `camp_id_idx` ON `campaign_links` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`userId` text NOT NULL,
	`document_id` text,
	`content` text,
	`status` text DEFAULT 'DRAFT',
	`scheduled_at` integer,
	`sent_at` integer,
	`total_sent` text DEFAULT '0',
	`total_opens` text DEFAULT '0',
	`total_clicks` text DEFAULT '0',
	`created_at` integer,
	`updated_at` integer,
	`is_ab_test` integer DEFAULT false,
	`parent_campaign_id` text,
	`variant_name` text,
	`variant_percentage` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `campaigns_user_id_idx` ON `campaigns` (`userId`);--> statement-breakpoint
CREATE INDEX `campaigns_status_idx` ON `campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `campaigns_scheduled_at_idx` ON `campaigns` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `campaigns_parent_id_idx` ON `campaigns` (`parent_campaign_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6366f1',
	`writer_id` text NOT NULL,
	`parent_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`writer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_writer_id_idx` ON `categories` (`writer_id`);--> statement-breakpoint
CREATE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_writer_slug_unique` ON `categories` (`writer_id`,`slug`);--> statement-breakpoint
CREATE TABLE `click_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text,
	`link_id` text,
	`clicked_at` integer NOT NULL,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`link_id`) REFERENCES `campaign_links`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sub_id_idx` ON `click_events` (`subscriber_id`);--> statement-breakpoint
CREATE INDEX `camp_ev_id_idx` ON `click_events` (`link_id`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_document_id_idx` ON `comments` (`document_id`);--> statement-breakpoint
CREATE INDEX `comments_user_id_idx` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `comments_parent_id_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_created_at_idx` ON `comments` (`created_at`);--> statement-breakpoint
CREATE TABLE `document_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`category_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `doc_categories_doc_id_idx` ON `document_categories` (`document_id`);--> statement-breakpoint
CREATE INDEX `doc_categories_cat_id_idx` ON `document_categories` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `doc_categories_unique` ON `document_categories` (`document_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `document_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_likes_document_id_idx` ON `document_likes` (`document_id`);--> statement-breakpoint
CREATE INDEX `document_likes_user_id_idx` ON `document_likes` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_likes_unique` ON `document_likes` (`document_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `document_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `doc_tags_doc_id_idx` ON `document_tags` (`document_id`);--> statement-breakpoint
CREATE INDEX `doc_tags_tag_id_idx` ON `document_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `doc_tags_unique` ON `document_tags` (`document_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text,
	`title` text,
	`subtitle` text,
	`status` text,
	`user_id` text,
	`markdown` text,
	`banner_image` text,
	`scheduled_date` integer,
	`published_date` integer,
	`created_at` integer,
	`updated_at` integer,
	`meta_title` text,
	`meta_description` text,
	`meta_keywords` text,
	`canonical_url` text,
	`og_image` text,
	`reading_time` text,
	`word_count` text,
	`is_featured` integer DEFAULT false,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `documents_user_id_idx` ON `documents` (`user_id`);--> statement-breakpoint
CREATE INDEX `documents_status_idx` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `documents_created_at_idx` ON `documents` (`created_at`);--> statement-breakpoint
CREATE INDEX `documents_scheduled_date_idx` ON `documents` (`scheduled_date`);--> statement-breakpoint
CREATE INDEX `documents_user_status_idx` ON `documents` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `documents_featured_idx` ON `documents` (`is_featured`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_slug_unique` ON `documents` (`slug`);--> statement-breakpoint
CREATE TABLE `newsletter_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`writer_id` text NOT NULL,
	`newsletter_name` text NOT NULL,
	`confirmation_url` text,
	`from_name` text NOT NULL,
	`logo_url` text,
	`brand_color` text DEFAULT '#000000',
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`writer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_settings_writer_id_unique` ON `newsletter_settings` (`writer_id`);--> statement-breakpoint
CREATE INDEX `writer_newsletter_writer_id_idx` ON `newsletter_settings` (`writer_id`);--> statement-breakpoint
CREATE INDEX `writer_newsletter_active_idx` ON `newsletter_settings` (`is_active`);--> statement-breakpoint
CREATE TABLE `oauth_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`refresh_token` text,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` text NOT NULL,
	`refresh_token_expires_at` text,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked` integer DEFAULT false,
	`revoked_at` text,
	FOREIGN KEY (`application_id`) REFERENCES `oauth_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_tokens_token_unique` ON `oauth_access_tokens` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_tokens_refresh_token_unique` ON `oauth_access_tokens` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_token_idx` ON `oauth_access_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_refresh_token_idx` ON `oauth_access_tokens` (`refresh_token`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_application_id_idx` ON `oauth_access_tokens` (`application_id`);--> statement-breakpoint
CREATE INDEX `oauth_access_tokens_user_id_idx` ON `oauth_access_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauth_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`overview` text,
	`logo_url` text,
	`website` text,
	`install_url` text,
	`screenshots` text DEFAULT '[]' NOT NULL,
	`redirect_uris` text DEFAULT '[]' NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`scopes` text DEFAULT '[]' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_public` integer DEFAULT false,
	`active` integer DEFAULT true,
	`status` text DEFAULT 'draft',
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_applications_slug_unique` ON `oauth_applications` (`slug`);--> statement-breakpoint
CREATE INDEX `oauth_applications_client_id_idx` ON `oauth_applications` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_applications_slug_idx` ON `oauth_applications` (`slug`);--> statement-breakpoint
CREATE TABLE `oauth_authorization_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scopes` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`used` integer DEFAULT false,
	`code_challenge` text,
	`code_challenge_method` text,
	FOREIGN KEY (`application_id`) REFERENCES `oauth_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_authorization_codes_code_unique` ON `oauth_authorization_codes` (`code`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_code_idx` ON `oauth_authorization_codes` (`code`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_application_id_idx` ON `oauth_authorization_codes` (`application_id`);--> statement-breakpoint
CREATE INDEX `oauth_authorization_codes_user_id_idx` ON `oauth_authorization_codes` (`user_id`);--> statement-breakpoint
CREATE TABLE `open_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text,
	`campaign_id` text,
	`opened_at` integer,
	`user_agent` text,
	`ip_address` text,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `open_sub_id_idx` ON `open_events` (`subscriber_id`);--> statement-breakpoint
CREATE INDEX `open_camp_id_idx` ON `open_events` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`writer_id` text,
	`subscribed_at` integer,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`is_confirmed` integer DEFAULT false,
	`is_unsubscribed` integer DEFAULT false,
	FOREIGN KEY (`writer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_email_unique` ON `subscribers` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_token_unique` ON `subscribers` (`token`);--> statement-breakpoint
CREATE INDEX `email_idx` ON `subscribers` (`email`);--> statement-breakpoint
CREATE INDEX `token_idx` ON `subscribers` (`token`);--> statement-breakpoint
CREATE INDEX `confirmed_idx` ON `subscribers` (`is_confirmed`);--> statement-breakpoint
CREATE INDEX `writer_id_idx` ON `subscribers` (`writer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sub_constraint` ON `subscribers` (`email`,`token`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`writer_id` text NOT NULL,
	`usage_count` text DEFAULT '0',
	`created_at` integer,
	FOREIGN KEY (`writer_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tags_writer_id_idx` ON `tags` (`writer_id`);--> statement-breakpoint
CREATE INDEX `tags_slug_idx` ON `tags` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_writer_slug_unique` ON `tags` (`writer_id`,`slug`);--> statement-breakpoint
CREATE TABLE `unsubscribe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscriber_id` text,
	`campaign_id` text,
	`unsubscribed_at` integer,
	`reason` text,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sub_rel_id_idx` ON `unsubscribe_events` (`subscriber_id`);--> statement-breakpoint
CREATE INDEX `camp_rel_id_idx` ON `unsubscribe_events` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `workspace_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'VIEWER',
	`token` text NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invites_token_unique` ON `workspace_invites` (`token`);--> statement-breakpoint
CREATE INDEX `workspace_invites_workspace_id_idx` ON `workspace_invites` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_invites_email_idx` ON `workspace_invites` (`email`);--> statement-breakpoint
CREATE INDEX `workspace_invites_token_idx` ON `workspace_invites` (`token`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'VIEWER',
	`invited_by` text,
	`invited_at` integer,
	`joined_at` integer,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workspace_members_workspace_id_idx` ON `workspace_members` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user_id_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_members_unique` ON `workspace_members` (`workspace_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`logo_url` text,
	`domain` text,
	`owner_id` text NOT NULL,
	`settings` text,
	`is_active` integer DEFAULT true,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_unique` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `workspaces_owner_id_idx` ON `workspaces` (`owner_id`);--> statement-breakpoint
CREATE INDEX `workspaces_slug_idx` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `workspaces_domain_idx` ON `workspaces` (`domain`);