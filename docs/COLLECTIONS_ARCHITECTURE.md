# Collections Architecture

## Overview

The Collections feature enables users to save, organize, and enrich various content types (links, text, images, AI resources) into organized collections. Every saved item is automatically enriched with AI-generated summaries, tags, and embeddings for powerful search and discovery.

## Feature Requirements

1. **Content Types**: Links, text snippets, images, AI-related resources
2. **Organization**: Collections (folders/categories) for grouping items
3. **AI Enrichment**: Automatic summaries, tags, and embeddings
4. **Search & Discovery**: Semantic search via embeddings, filtering by tags/collections
5. **API/SDK**: REST API with OpenAPI spec, SDK wrappers for popular languages
6. **Multi-device Sync**: Real-time sync across devices
7. **Browser Extensions**: Save content directly from browser
8. **Webhooks**: Event notifications for external integrations

## Architecture Integration

### Relationship with Existing Features

#### Documents Integration

- **Shared Content Model**: Collections can reference documents (one-to-many)
- **Cross-linking**: Documents can link to collections and vice versa
- **Shared Search**: Unified search across documents and collections
- **Newsletter Integration**: Collections can be curated into newsletter content

#### Newsletter Integration

- **Content Source**: Collections can serve as content sources for newsletters
- **Curated Collections**: Newsletter campaigns can pull from specific collections
- **Automated Digests**: Scheduled newsletters from collection updates

### Data Model

```typescript
// Collections (folders/categories)
collections {
  id: string (PK)
  userId: string (FK -> user.id)
  name: string
  description: string | null
  color: string | null (for UI)
  icon: string | null
  isPublic: boolean (default: false)
  createdAt: timestamp
  updatedAt: timestamp
}

// Collection Items (saved content)
collection_items {
  id: string (PK)
  collectionId: string (FK -> collections.id)
  userId: string (FK -> user.id)

  // Content type and data
  type: enum('link', 'text', 'image', 'ai_resource', 'document_reference')
  title: string
  url: string | null (for links)
  content: text | null (for text snippets)
  imageUrl: string | null (for images)
  metadata: jsonb (flexible storage for type-specific data)

  // AI Enrichment
  summary: text | null (AI-generated)
  tags: text[] (AI-generated + user-added)
  embedding: vector | null (for semantic search)
  embeddingModel: string | null (e.g., 'text-embedding-3-small')

  // Relationships
  documentId: string | null (FK -> documents.id, if referencing a document)

  // Metadata
  savedAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}

// Collection Item Tags (many-to-many for better querying)
collection_item_tags {
  id: string (PK)
  itemId: string (FK -> collection_items.id)
  tag: string (indexed)
  source: enum('ai', 'user') (who created the tag)
  createdAt: timestamp
}

// Webhooks (for external integrations)
webhooks {
  id: string (PK)
  userId: string (FK -> user.id)
  url: string
  events: text[] (e.g., ['item.created', 'item.updated', 'collection.created'])
  secret: string (for signature verification)
  isActive: boolean
  createdAt: timestamp
  updatedAt: timestamp
}

// Webhook Deliveries (audit trail)
webhook_deliveries {
  id: string (PK)
  webhookId: string (FK -> webhooks.id)
  event: string
  payload: jsonb
  status: enum('pending', 'success', 'failed')
  responseCode: number | null
  responseBody: text | null
  attempts: number
  deliveredAt: timestamp | null
  createdAt: timestamp
}
```

### Database Schema Location

**File**: `api/src/db/schema.ts`

Add new tables following existing patterns:

- Use `createTable` helper for namespaced tables
- Add proper indexes for query performance
- Foreign keys with cascade deletes
- Timestamps with timezone support

### API Structure

#### REST API Routes

**File**: `api/src/rest/routers/collections.ts`

```typescript
// Collections CRUD
GET    /v1/collections              // List user's collections
POST   /v1/collections              // Create collection
GET    /v1/collections/:id          // Get collection details
PATCH  /v1/collections/:id          // Update collection
DELETE /v1/collections/:id          // Delete collection

// Collection Items
GET    /v1/collections/:id/items    // List items in collection
POST   /v1/collections/:id/items    // Add item to collection
GET    /v1/items/:id                // Get item details
PATCH  /v1/items/:id                // Update item
DELETE /v1/items/:id                // Delete item
POST   /v1/items/:id/move           // Move item to another collection

// Search & Discovery
POST   /v1/items/search             // Semantic search (vector similarity)
GET    /v1/items/search             // Text search (full-text + filters)
GET    /v1/tags                     // List all user's tags
GET    /v1/tags/:tag/items          // Get items by tag

// Bulk Operations
POST   /v1/items/batch              // Create multiple items
POST   /v1/items/batch/delete       // Delete multiple items

// Webhooks
GET    /v1/webhooks                 // List webhooks
POST   /v1/webhooks                 // Create webhook
PATCH  /v1/webhooks/:id             // Update webhook
DELETE /v1/webhooks/:id             // Delete webhook
GET    /v1/webhooks/:id/deliveries  // Get webhook delivery history
```

#### tRPC Routes

**File**: `api/src/trpc/routers/collections.ts`

Mirror REST API functionality with type-safe tRPC procedures:

- `collections.list`
- `collections.create`
- `collections.update`
- `collections.delete`
- `items.list`
- `items.create`
- `items.search`
- `items.semanticSearch`
- `webhooks.*`

### AI Enrichment Pipeline

#### Queue-Based Processing

**File**: `api/src/services/collections-enrichment.ts`

Use existing queue system for async AI processing:

```typescript
// When item is created:
1. Enqueue enrichment job
2. Job processor:
   - Extract content (fetch URL if link, parse text, etc.)
   - Generate summary (AI API call)
   - Generate tags (AI API call)
   - Generate embedding (AI API call)
   - Update item in database
   - Upsert embedding to Vectorize
   - Trigger webhooks if configured
```

**Queue Configuration**:

- Queue name: `collections-enrichment`
- Priority: 5 (medium)
- Max attempts: 3
- Retry backoff: exponential

#### AI Service Integration

**File**: `api/src/services/ai-enrichment.ts`

```typescript
// Use Cloudflare AI Workers or external API (OpenAI, Anthropic)
async function enrichItem(item: CollectionItem) {
  const content = await extractContent(item);

  // Parallel processing
  const [summary, tags, embedding] = await Promise.all([
    generateSummary(content),
    generateTags(content),
    generateEmbedding(content),
  ]);

  return { summary, tags, embedding };
}
```

### Vector Search Integration

#### Cloudflare Vectorize

**Configuration**: `wrangler.jsonc`

```jsonc
{
  "vectorize": [
    {
      "binding": "COLLECTIONS_INDEX",
      "index_name": "collections-embeddings",
      "dimensions": 1536, // OpenAI text-embedding-3-small
      "metric": "cosine"
    }
  ]
}
```

**Usage**:

- Store embeddings with item ID as vector ID
- Metadata includes: userId, collectionId, type, title
- Query by similarity for semantic search

**File**: `api/src/services/vector-search.ts`

```typescript
async function semanticSearch(
  query: string,
  userId: string,
  options: SearchOptions
) {
  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Search Vectorize index
  const results = await env.COLLECTIONS_INDEX.query(queryEmbedding, {
    topK: options.limit || 10,
    filter: { userId }, // Filter by user
    returnMetadata: true,
  });

  // Fetch full items from database
  const itemIds = results.matches.map((m) => m.id);
  return getItemsByIds(itemIds);
}
```

### Scopes & Permissions

**File**: `packages/common/src/scopes.ts`

Add new scopes:

```typescript
"collections.read",
"collections.write",
"collections.search",
"webhooks.read",
"webhooks.write",
```

Update scope presets to include collections scopes.

### Browser Extension Architecture

#### Extension Components

1. **Content Script**: Injected into web pages
2. **Background Service Worker**: Handles API calls
3. **Popup UI**: Quick save interface
4. **Options Page**: Settings and collection management

#### Save Flow

```
User clicks extension icon
  ↓
Extension extracts page content (title, URL, selected text, images)
  ↓
User selects collection (or creates new)
  ↓
Extension calls API: POST /v1/collections/:id/items
  ↓
API creates item and enqueues enrichment job
  ↓
Extension shows success notification
```

**API Endpoint**: Use existing REST API with API key authentication

### Multi-Device Sync

#### Sync Strategy

1. **Real-time Updates**: WebSocket or Server-Sent Events (SSE)
2. **Polling**: Extension/background service polls for updates
3. **Webhooks**: External apps receive real-time notifications

**Implementation**:

- Use Cloudflare Durable Objects for WebSocket connections
- Or use existing queue system for webhook delivery
- Last sync timestamp stored per device

### Webhooks System

#### Event Types

```typescript
"collection.created";
"collection.updated";
"collection.deleted";
"item.created";
"item.updated";
"item.deleted";
"item.enriched"; // When AI enrichment completes
```

#### Delivery Flow

**File**: `api/src/services/webhook-delivery.ts`

```typescript
// When event occurs:
1. Find active webhooks for user + event type
2. For each webhook:
   - Enqueue webhook delivery job
   - Job processor:
     - Sign payload with webhook secret
     - POST to webhook URL
     - Retry on failure (exponential backoff)
     - Log delivery in webhook_deliveries table
```

Use existing queue system (`email` queue or new `webhooks` queue).

### SDK Wrappers

#### Structure

```
packages/
  collections-sdk/
    javascript/
      package.json
      src/
        index.ts
        client.ts
        types.ts
    python/
      setup.py
      src/
        __init__.py
        client.py
        types.py
    rust/
      Cargo.toml
      src/
        lib.rs
        client.rs
        types.rs
```

#### JavaScript SDK Example

**File**: `packages/collections-sdk/javascript/src/client.ts`

```typescript
export class CollectionsClient {
  constructor(private apiKey: string, private baseUrl: string) {}

  async createCollection(data: CreateCollectionInput) {
    return fetch(`${this.baseUrl}/v1/collections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }).then((r) => r.json());
  }

  async searchItems(query: string, options?: SearchOptions) {
    return fetch(`${this.baseUrl}/v1/items/search?q=${query}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }).then((r) => r.json());
  }

  async semanticSearch(query: string, options?: SearchOptions) {
    return fetch(`${this.baseUrl}/v1/items/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, type: "semantic", ...options }),
    }).then((r) => r.json());
  }
}
```

### OpenAPI Specification

The OpenAPI spec is automatically generated from Hono routes using `@hono/zod-openapi`.

**Enhancements needed**:

- Add collections endpoints to OpenAPI
- Include example requests/responses
- Document webhook payloads
- Add SDK code examples

### File Structure

```
api/
  src/
    db/
      queries/
        collections.ts          // Collection queries
        collection-items.ts     // Item queries
        webhooks.ts             // Webhook queries
    rest/
      routers/
        collections.ts          // REST API routes
    trpc/
      routers/
        collections.ts          // tRPC routes
    services/
      collections-enrichment.ts // AI enrichment service
      ai-enrichment.ts          // AI API integration
      vector-search.ts          // Vector search service
      webhook-delivery.ts       // Webhook delivery service
    schemas/
      collections.ts            // Zod schemas
packages/
  collections-sdk/
    javascript/
    python/
    rust/
web/
  src/
    components/
      collections/              // UI components
    routes/
      collections/              // Collection pages
```

### Integration Points

#### 1. Documents ↔ Collections

**Use Cases**:

- Save document as collection item
- Link collection items in document content
- Create document from collection items

**Implementation**:

- `collection_items.documentId` foreign key
- API endpoint: `POST /v1/documents/:id/save-to-collection`

#### 2. Newsletter ↔ Collections

**Use Cases**:

- Curate newsletter from collection
- Auto-include new collection items in digest
- Collection-based newsletter campaigns

**Implementation**:

- Extend `campaigns` table or create junction table
- API endpoint: `POST /v1/newsletter/campaigns/from-collection`

#### 3. Search Integration

**Unified Search**:

- Search across documents AND collections
- API endpoint: `GET /v1/search?q=query&types=documents,collections`

### Performance Considerations

1. **Embedding Generation**: Async via queue (non-blocking)
2. **Vector Search**: Use Vectorize index (fast similarity search)
3. **Full-text Search**: PostgreSQL full-text search indexes
4. **Caching**: Cache frequently accessed collections/items
5. **Pagination**: All list endpoints support cursor-based pagination

### Security

1. **Authentication**: Existing API key + session auth
2. **Authorization**: Scope-based (`collections.read`, `collections.write`)
3. **Data Isolation**: All queries filtered by `userId`
4. **Webhook Security**: HMAC signature verification
5. **Rate Limiting**: Per-user rate limits for API endpoints

### Migration Strategy

1. **Phase 1**: Database schema + basic CRUD APIs
2. **Phase 2**: AI enrichment pipeline
3. **Phase 3**: Vector search integration
4. **Phase 4**: Browser extension
5. **Phase 5**: Webhooks system
6. **Phase 6**: SDK wrappers
7. **Phase 7**: UI integration

### Testing Strategy

1. **Unit Tests**: Query functions, enrichment logic
2. **Integration Tests**: API endpoints, queue processing
3. **E2E Tests**: Browser extension, full save flow
4. **Performance Tests**: Vector search, bulk operations

### Monitoring & Observability

1. **Metrics**: Enrichment job success rate, search latency
2. **Logging**: All API calls, webhook deliveries
3. **Alerts**: Failed enrichment jobs, webhook delivery failures
4. **Analytics**: Collection usage, popular tags, search queries

## Next Steps

1. Review and approve architecture
2. Create database migration
3. Implement core CRUD APIs
4. Set up AI enrichment pipeline
5. Integrate Vectorize for semantic search
6. Build browser extension MVP
7. Add webhook system
8. Create SDK wrappers
9. Build UI components
10. Write documentation
