# Collections Feature Implementation Roadmap

## Quick Start Checklist

### Phase 1: Database Schema (Priority: High)

#### Step 1.1: Create Migration

**File**: `api/migrations/0012_collections_feature.sql`

```sql
-- Collections table
CREATE TABLE "brainos_collections" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "color" text,
  "icon" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "collections_user_id_idx" ON "brainos_collections"("user_id");
CREATE INDEX "collections_is_public_idx" ON "brainos_collections"("is_public");

-- Collection items table
CREATE TYPE "collection_item_type" AS ENUM('link', 'text', 'image', 'ai_resource', 'document_reference');

CREATE TABLE "brainos_collection_items" (
  "id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL,
  "user_id" text NOT NULL,
  "type" "collection_item_type" NOT NULL,
  "title" text NOT NULL,
  "url" text,
  "content" text,
  "image_url" text,
  "metadata" jsonb,
  "summary" text,
  "tags" text[] DEFAULT '{}'::text[],
  "embedding_model" text,
  "document_id" text,
  "saved_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "brainos_collections"("id") ON DELETE CASCADE,
  CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "brainos_documents"("id") ON DELETE SET NULL
);

CREATE INDEX "items_collection_id_idx" ON "brainos_collection_items"("collection_id");
CREATE INDEX "items_user_id_idx" ON "brainos_collection_items"("user_id");
CREATE INDEX "items_type_idx" ON "brainos_collection_items"("type");
CREATE INDEX "items_tags_idx" ON "brainos_collection_items" USING GIN("tags");
CREATE INDEX "items_document_id_idx" ON "brainos_collection_items"("document_id");
CREATE INDEX "items_created_at_idx" ON "brainos_collection_items"("created_at");

-- Collection item tags (for better tag querying)
CREATE TABLE "brainos_collection_item_tags" (
  "id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL,
  "tag" text NOT NULL,
  "source" text NOT NULL, -- 'ai' or 'user'
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "item_tags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "brainos_collection_items"("id") ON DELETE CASCADE
);

CREATE INDEX "item_tags_item_id_idx" ON "brainos_collection_item_tags"("item_id");
CREATE INDEX "item_tags_tag_idx" ON "brainos_collection_item_tags"("tag");

-- Webhooks table
CREATE TABLE "brainos_webhooks" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "url" text NOT NULL,
  "events" text[] NOT NULL,
  "secret" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "webhooks_user_id_idx" ON "brainos_webhooks"("user_id");
CREATE INDEX "webhooks_is_active_idx" ON "brainos_webhooks"("is_active");

-- Webhook deliveries table
CREATE TYPE "webhook_delivery_status" AS ENUM('pending', 'success', 'failed');

CREATE TABLE "brainos_webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "webhook_id" text NOT NULL,
  "event" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
  "response_code" integer,
  "response_body" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "delivered_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "brainos_webhooks"("id") ON DELETE CASCADE
);

CREATE INDEX "deliveries_webhook_id_idx" ON "brainos_webhook_deliveries"("webhook_id");
CREATE INDEX "deliveries_status_idx" ON "brainos_webhook_deliveries"("status");
CREATE INDEX "deliveries_created_at_idx" ON "brainos_webhook_deliveries"("created_at");
```

#### Step 1.2: Update Schema File

**File**: `api/src/db/schema.ts`

Add schema definitions following existing patterns.

### Phase 2: Core APIs (Priority: High)

#### Step 2.1: Create Schemas

**File**: `api/src/schemas/collections.ts`

```typescript
import { z } from "zod";

export const collectionItemTypeEnum = z.enum([
  "link",
  "text",
  "image",
  "ai_resource",
  "document_reference",
]);

export const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  icon: z.string().optional(),
  isPublic: z.boolean().default(false),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const createCollectionItemSchema = z.object({
  collectionId: z.string(),
  type: collectionItemTypeEnum,
  title: z.string().min(1).max(200),
  url: z.string().url().optional(),
  content: z.string().optional(),
  imageUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
  documentId: z.string().optional(),
});

// ... more schemas
```

#### Step 2.2: Create Database Queries

**File**: `api/src/db/queries/collections.ts`

```typescript
import { eq, and, desc } from "drizzle-orm";
import { collections, collectionItems } from "@api/db/schema";
import { generateId } from "@api/lib/utils";

export async function getUserCollections(
  db: DB,
  userId: string
): Promise<Collection[]> {
  return db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt));
}

export async function createCollection(
  db: DB,
  data: CreateCollectionInput,
  userId: string
): Promise<Collection> {
  const [collection] = await db
    .insert(collections)
    .values({
      id: generateId(),
      userId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return collection;
}

// ... more query functions
```

**File**: `api/src/db/queries/collection-items.ts`

Similar pattern for item queries.

#### Step 2.3: Create REST Router

**File**: `api/src/rest/routers/collections.ts`

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "@api/lib/utils";
import { withRequiredScope } from "@api/rest/middleware";
import {
  getUserCollections,
  createCollection,
  // ... more imports
} from "@api/db/queries/collections";

const collectionsRouter = createRouter();

collectionsRouter.openapi(
  createRoute({
    method: "get",
    path: "/collections",
    tags: ["Collections"],
    summary: "List user's collections",
    responses: {
      200: {
        description: "List of collections",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(collectionSchema),
            }),
          },
        },
      },
    },
    middleware: [withRequiredScope("collections.read")],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const collections = await getUserCollections(db, session.user.id);
    return c.json({ data: collections });
  }
);

// ... more routes

export { collectionsRouter };
```

#### Step 2.4: Register Router

**File**: `api/src/rest/routers/index.ts`

```typescript
import { collectionsRouter } from "./collections";

export const routers = createRouter()
  .route("/documents", documentsRouter)
  .route("/newsletter", newsletterRouter)
  .route("/collections", collectionsRouter); // Add this
```

### Phase 3: AI Enrichment (Priority: Medium)

#### Step 3.1: Create AI Service

**File**: `api/src/services/ai-enrichment.ts`

```typescript
// Use Cloudflare AI Workers or external API
export async function generateSummary(content: string): Promise<string> {
  // Implementation using AI API
}

export async function generateTags(content: string): Promise<string[]> {
  // Implementation
}

export async function generateEmbedding(content: string): Promise<number[]> {
  // Implementation using OpenAI or Cloudflare AI
}
```

#### Step 3.2: Create Enrichment Service

**File**: `api/src/services/collections-enrichment.ts`

```typescript
import { enqueue } from "@api/queue";
import {
  generateSummary,
  generateTags,
  generateEmbedding,
} from "./ai-enrichment";

export async function enqueueItemEnrichment(
  env: Env,
  itemId: string,
  itemData: CollectionItem
) {
  await enqueue(env, "collections-enrichment", {
    type: "enrich-item",
    itemId,
    itemData,
  });
}

export async function processEnrichmentJob(
  env: Env,
  job: EnrichmentJob
): Promise<void> {
  const { itemId, itemData } = job.data;

  // Extract content based on type
  const content = await extractContent(itemData);

  // Generate enrichment in parallel
  const [summary, tags, embedding] = await Promise.all([
    generateSummary(content),
    generateTags(content),
    generateEmbedding(content),
  ]);

  // Update item in database
  await updateItemEnrichment(env.db, itemId, {
    summary,
    tags,
    embedding,
    embeddingModel: "text-embedding-3-small",
  });

  // Upsert to Vectorize
  if (embedding) {
    await env.COLLECTIONS_INDEX.upsert([
      {
        id: itemId,
        values: embedding,
        metadata: {
          userId: itemData.userId,
          collectionId: itemData.collectionId,
          type: itemData.type,
          title: itemData.title,
        },
      },
    ]);
  }
}
```

#### Step 3.3: Update Queue Configuration

**File**: `api/src/queue/constants.ts`

```typescript
export const QUEUES = {
  email: "email",
  "collections-enrichment": "collections-enrichment", // Add this
  webhooks: "webhooks", // Add this
} as const;
```

### Phase 4: Vector Search (Priority: Medium)

#### Step 4.1: Configure Vectorize

**File**: `wrangler.jsonc`

```jsonc
{
  "vectorize": [
    {
      "binding": "COLLECTIONS_INDEX",
      "index_name": "collections-embeddings",
      "dimensions": 1536,
      "metric": "cosine"
    }
  ]
}
```

#### Step 4.2: Create Vector Search Service

**File**: `api/src/services/vector-search.ts`

```typescript
export async function semanticSearch(
  env: Env,
  query: string,
  userId: string,
  options: SearchOptions
) {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search Vectorize
  const results = await env.COLLECTIONS_INDEX.query(queryEmbedding, {
    topK: options.limit || 10,
    filter: { userId },
    returnMetadata: true,
  });

  // Fetch full items
  const itemIds = results.matches.map((m) => m.id);
  return getItemsByIds(env.db, itemIds);
}
```

### Phase 5: Scopes (Priority: High)

#### Step 5.1: Update Scopes

**File**: `packages/common/src/scopes.ts`

```typescript
export const SCOPES = [
  "documents.read",
  "documents.write",
  "collections.read", // Add
  "collections.write", // Add
  "collections.search", // Add
  "webhooks.read", // Add
  "webhooks.write", // Add
  // ... existing scopes
] as const;
```

### Phase 6: tRPC Router (Priority: Medium)

#### Step 6.1: Create tRPC Router

**File**: `api/src/trpc/routers/collections.ts`

Mirror REST API functionality with type-safe procedures.

### Phase 7: Webhooks (Priority: Low)

#### Step 7.1: Webhook Service

**File**: `api/src/services/webhook-delivery.ts`

Similar to email queue, but for webhook deliveries.

## Testing Checklist

- [ ] Unit tests for query functions
- [ ] Integration tests for API endpoints
- [ ] E2E tests for save flow
- [ ] Performance tests for vector search
- [ ] Webhook delivery tests

## Deployment Checklist

- [ ] Run database migration
- [ ] Create Vectorize index
- [ ] Update wrangler.jsonc
- [ ] Deploy API changes
- [ ] Test API endpoints
- [ ] Monitor queue processing
- [ ] Set up alerts

## Next Steps After Implementation

1. Build browser extension
2. Create SDK wrappers
3. Build web UI
4. Write documentation
5. Create example integrations
