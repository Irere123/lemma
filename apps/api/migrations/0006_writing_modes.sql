CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`subtitle` text,
	`description` text,
	`slug` text,
	`cover_image` text,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`word_target` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `books_user_idx` ON `books` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_unique` ON `books` (`slug`);--> statement-breakpoint
CREATE TABLE `document_links` (
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	`block_id` text,
	`context` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_links_target_idx` ON `document_links` (`target_id`);--> statement-breakpoint
CREATE INDEX `document_links_source_idx` ON `document_links` (`source_id`);--> statement-breakpoint
CREATE TABLE `document_references` (
	`document_id` text NOT NULL,
	`reference_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reference_id`) REFERENCES `reference_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_references_reference_idx` ON `document_references` (`reference_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_references_unique` ON `document_references` (`document_id`,`reference_id`);--> statement-breakpoint
CREATE TABLE `reference_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`csl` text NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reference_items_user_key` ON `reference_items` (`user_id`,`key`);--> statement-breakpoint
ALTER TABLE `documents` ADD `kind` text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `book_id` text REFERENCES books(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `documents` ADD `position` integer;--> statement-breakpoint
ALTER TABLE `documents` ADD `word_target` integer;--> statement-breakpoint
ALTER TABLE `documents` ADD `journal_date` text;--> statement-breakpoint
CREATE INDEX `documents_book_idx` ON `documents` (`book_id`,`position`);--> statement-breakpoint
CREATE INDEX `documents_user_kind_idx` ON `documents` (`user_id`,`kind`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `documents_user_journal_unique` ON `documents` (`user_id`,`journal_date`);