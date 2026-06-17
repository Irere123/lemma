CREATE TABLE `newsletter_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`subscriber_id` text NOT NULL,
	`delivered_at` integer,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `newsletter_deliveries_campaign_idx` ON `newsletter_deliveries` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `newsletter_deliveries_subscriber_idx` ON `newsletter_deliveries` (`subscriber_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_deliveries_unique` ON `newsletter_deliveries` (`campaign_id`,`subscriber_id`);