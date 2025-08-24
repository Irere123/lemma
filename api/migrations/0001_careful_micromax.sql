CREATE TYPE "public"."document_staus" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('ARTICLE', 'NEWSLETTER', 'NOTE');--> statement-breakpoint
CREATE TABLE "brainos_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"type" "document_type",
	"status" "document_staus",
	"content" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
