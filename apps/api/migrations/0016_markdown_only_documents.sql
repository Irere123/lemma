UPDATE "brainos_documents"
SET "markdown" = trim(both '"' from "content"::text)
WHERE "markdown" IS NULL
  AND "content" IS NOT NULL
  AND jsonb_typeof("content") = 'string';--> statement-breakpoint

UPDATE "brainos_documents"
SET "markdown" = ''
WHERE "markdown" IS NULL;--> statement-breakpoint

ALTER TABLE "brainos_documents" ALTER COLUMN "markdown" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "brainos_documents" ALTER COLUMN "markdown" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "brainos_documents" DROP COLUMN "content";
