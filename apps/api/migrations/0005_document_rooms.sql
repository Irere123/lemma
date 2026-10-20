CREATE TABLE `document_html` (
	`document_id` text NOT NULL,
	`part` integer NOT NULL,
	`html` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_html_part_unique` ON `document_html` (`document_id`,`part`);--> statement-breakpoint
CREATE TABLE `document_legacy_bodies` (
	`document_id` text PRIMARY KEY NOT NULL,
	`content` text,
	`markdown` text,
	`html` text,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE `document_search` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` text NOT NULL,
	`user_id` text,
	`part` integer NOT NULL,
	`title` text,
	`subtitle` text,
	`body` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_search_document_idx` ON `document_search` (`document_id`);--> statement-breakpoint
CREATE INDEX `document_search_user_idx` ON `document_search` (`user_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `body_store` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `first_published_at` integer;--> statement-breakpoint
-- Search moves off documents.markdown (which held a whole book and was
-- re-indexed on every keystroke-save) onto chunked plain text that each
-- DocumentRoom maintains.
DROP TRIGGER IF EXISTS `documents_fts_ai`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `documents_fts_ad`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `documents_fts_au`;--> statement-breakpoint
DROP TABLE IF EXISTS `documents_fts`;--> statement-breakpoint
CREATE VIRTUAL TABLE `document_search_fts` USING fts5(
	title,
	subtitle,
	body,
	content='document_search',
	content_rowid='id',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `document_search_ai` AFTER INSERT ON `document_search` BEGIN
	INSERT INTO `document_search_fts`(`rowid`, `title`, `subtitle`, `body`)
	VALUES (new.`id`, new.`title`, new.`subtitle`, new.`body`);
END;
--> statement-breakpoint
CREATE TRIGGER `document_search_ad` AFTER DELETE ON `document_search` BEGIN
	INSERT INTO `document_search_fts`(`document_search_fts`, `rowid`, `title`, `subtitle`, `body`)
	VALUES ('delete', old.`id`, old.`title`, old.`subtitle`, old.`body`);
END;
--> statement-breakpoint
CREATE TRIGGER `document_search_au` AFTER UPDATE ON `document_search` BEGIN
	INSERT INTO `document_search_fts`(`document_search_fts`, `rowid`, `title`, `subtitle`, `body`)
	VALUES ('delete', old.`id`, old.`title`, old.`subtitle`, old.`body`);
	INSERT INTO `document_search_fts`(`rowid`, `title`, `subtitle`, `body`)
	VALUES (new.`id`, new.`title`, new.`subtitle`, new.`body`);
END;
--> statement-breakpoint
-- Until a document's room re-indexes it, search its legacy markdown.
INSERT INTO `document_search` (`document_id`, `user_id`, `part`, `title`, `subtitle`, `body`)
	SELECT `id`, `user_id`, 0, `title`, `subtitle`, COALESCE(`markdown`, '') FROM `documents`;
--> statement-breakpoint
-- Published HTML moves to its own table; the cron re-renders it with the
-- current renderer as each document's room seeds.
INSERT INTO `document_html` (`document_id`, `part`, `html`)
	SELECT `id`, 0, `html` FROM `documents`
	WHERE `status` = 'PUBLISHED' AND `html` IS NOT NULL AND `html` != '';
--> statement-breakpoint
UPDATE `documents` SET `first_published_at` = COALESCE(`published_date`, `updated_at`, `created_at`)
	WHERE `status` = 'PUBLISHED';
