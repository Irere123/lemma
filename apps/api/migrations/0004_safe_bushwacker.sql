ALTER TABLE `documents` ADD `content` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `html` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `excerpt` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `content_version` integer DEFAULT 1;