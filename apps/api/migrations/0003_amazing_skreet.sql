CREATE TABLE `follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follows_following_id_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE INDEX `follows_follower_id_idx` ON `follows` (`follower_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `follows_unique` ON `follows` (`follower_id`,`following_id`);--> statement-breakpoint
DROP INDEX `subscribers_email_unique`;--> statement-breakpoint
DROP INDEX `sub_constraint`;--> statement-breakpoint
CREATE UNIQUE INDEX `sub_writer_email` ON `subscribers` (`writer_id`,`email`);--> statement-breakpoint
ALTER TABLE `user` ADD `username` text;--> statement-breakpoint
ALTER TABLE `user` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `user` ADD `website` text;--> statement-breakpoint
ALTER TABLE `user` ADD `location` text;--> statement-breakpoint
ALTER TABLE `user` ADD `social_links` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE INDEX `user_username_idx` ON `user` (`username`);