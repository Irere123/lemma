-- Full-text search over documents (title, subtitle, markdown body) using SQLite
-- FTS5. The virtual table is "external content" (content='documents'): it stores
-- only the inverted index and reads column values back from `documents` via its
-- implicit integer rowid. Triggers keep the index in sync on write.
CREATE VIRTUAL TABLE `documents_fts` USING fts5(
	title,
	subtitle,
	markdown,
	content='documents',
	content_rowid='rowid',
	tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Backfill the index from existing documents.
INSERT INTO `documents_fts`(`rowid`, `title`, `subtitle`, `markdown`)
	SELECT `rowid`, `title`, `subtitle`, `markdown` FROM `documents`;
--> statement-breakpoint
CREATE TRIGGER `documents_fts_ai` AFTER INSERT ON `documents` BEGIN
	INSERT INTO `documents_fts`(`rowid`, `title`, `subtitle`, `markdown`)
	VALUES (new.`rowid`, new.`title`, new.`subtitle`, new.`markdown`);
END;
--> statement-breakpoint
CREATE TRIGGER `documents_fts_ad` AFTER DELETE ON `documents` BEGIN
	INSERT INTO `documents_fts`(`documents_fts`, `rowid`, `title`, `subtitle`, `markdown`)
	VALUES ('delete', old.`rowid`, old.`title`, old.`subtitle`, old.`markdown`);
END;
--> statement-breakpoint
CREATE TRIGGER `documents_fts_au` AFTER UPDATE ON `documents` BEGIN
	INSERT INTO `documents_fts`(`documents_fts`, `rowid`, `title`, `subtitle`, `markdown`)
	VALUES ('delete', old.`rowid`, old.`title`, old.`subtitle`, old.`markdown`);
	INSERT INTO `documents_fts`(`rowid`, `title`, `subtitle`, `markdown`)
	VALUES (new.`rowid`, new.`title`, new.`subtitle`, new.`markdown`);
END;
