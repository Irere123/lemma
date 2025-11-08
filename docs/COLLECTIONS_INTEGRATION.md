# Collections Feature Integration Guide

## Overview

This document outlines how the Collections feature integrates with existing Documents and Newsletter systems, creating a unified knowledge management platform.

## System Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface Layer                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Documents   │  │ Collections  │  │  Newsletter  │           │
│  │   Editor     │  │   Manager    │  │   Dashboard  │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                  │                    │
│         └─────────────────┼──────────────────┘                    │
│                           │                                        │
└───────────────────────────┼────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          API Layer (Hono)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Documents   │  │ Collections  │  │  Newsletter   │           │
│  │   Router     │  │   Router     │  │   Router     │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                  │                    │
│         └─────────────────┼──────────────────┘                    │
│                           │                                        │
│                    ┌──────▼───────┐                                │
│                    │ Unified      │                                │
│                    │ Search API   │                                │
│                    └─────────────┘                                │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Business Logic Layer                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              AI Enrichment Pipeline                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │  │
│  │  │ Summary  │  │   Tags   │  │Embedding │                  │  │
│  │  │Generator │  │Generator │  │Generator │                  │  │
│  │  └──────────┘  └──────────┘  └──────────┘                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Queue System (Durable Objects)                   │  │
│  │  • Enrichment Jobs                                            │  │
│  │  • Webhook Deliveries                                         │  │
│  │  • Newsletter Processing                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
└───────────────────────────┬────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Data Layer                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │  Vectorize   │  │     KV       │           │
│  │  (Hyperdrive)│  │   (Embeddings)│  │  (Cache)     │           │
│  │              │  │              │  │             │           │
│  │ • documents  │  │ • collection │  │ • API keys  │           │
│  │ • collections│  │   embeddings │  │ • users      │           │
│  │ • items      │  │              │  │             │           │
│  │ • webhooks   │  │              │  │             │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. Documents ↔ Collections

#### Use Cases

**A. Save Document to Collection**

- User writes a document and wants to save it to a collection
- Document becomes a reference in a collection item
- Enables cross-linking between documents and collections

**B. Link Collection Items in Documents**

- While writing, user can reference collection items
- Creates bidirectional links between content types
- Enables "related resources" sections

**C. Create Document from Collection**

- User selects multiple collection items
- Generates a document with references to those items
- Useful for creating curated articles

#### Implementation

```typescript
// API Endpoint
POST /v1/documents/:id/save-to-collection
{
  collectionId: string,
  title?: string, // Override item title
  notes?: string  // Additional context
}

// Creates a collection_item with:
// - type: 'document_reference'
// - documentId: <document.id>
// - title: <document.title> or override
// - metadata: { documentSlug, documentStatus }
```

**Database Relationship**:

```sql
collection_items.documentId → documents.id (FK, nullable)
```

### 2. Newsletter ↔ Collections

#### Use Cases

**A. Curate Newsletter from Collection**

- Select a collection as content source
- Newsletter includes items from that collection
- Automatically formats items for email

**B. Auto-Digest from Collections**

- Scheduled newsletter that includes new items from specific collections
- Configurable: daily, weekly, monthly
- Filters: only items added since last digest

**C. Collection-Based Campaigns**

- Create newsletter campaign from collection
- Each item becomes a section in the newsletter
- Maintains collection structure in email

#### Implementation

```typescript
// Extend campaigns table or create junction
campaign_collections {
  campaignId: string (FK -> campaigns.id)
  collectionId: string (FK -> collections.id)
  filterTags?: string[] // Optional tag filter
  itemLimit?: number     // Max items to include
}

// API Endpoint
POST /v1/newsletter/campaigns/from-collection
{
  collectionId: string,
  title: string,
  filterTags?: string[],
  itemLimit?: number,
  scheduledDate?: timestamp
}
```

### 3. Unified Search

#### Use Cases

**A. Cross-Content Search**

- Search across documents, collections, and items simultaneously
- Unified relevance ranking
- Filter by content type

**B. Semantic Search**

- Vector-based similarity search across all content
- Finds related content regardless of type
- Enables discovery of connections

#### Implementation

```typescript
// Unified Search Endpoint
GET /v1/search?q=query&types=documents,collections,items

// Response includes results from all types:
{
  documents: Document[],
  collections: Collection[],
  items: CollectionItem[],
  // Combined relevance score
}
```

**Search Strategy**:

1. **Text Search**: PostgreSQL full-text search on documents + items
2. **Vector Search**: Vectorize similarity search on embeddings
3. **Hybrid**: Combine both with weighted scoring

### 4. Shared Tag System

#### Use Cases

**A. Unified Tagging**

- Tags work across documents and collection items
- Single tag management interface
- Tag-based navigation

**B. Tag-Based Discovery**

- Find all content (documents + items) with a tag
- Tag pages showing related content
- Tag suggestions based on existing tags

#### Implementation

```typescript
// Shared tags table (or extend existing)
tags {
  id: string
  name: string
  userId: string
  usageCount: number // How many items/documents use it
  createdAt: timestamp
}

// Junction tables
document_tags {
  documentId: string
  tagId: string
}

collection_item_tags {
  itemId: string
  tagId: string
}
```

## Data Flow Examples

### Example 1: Save Link to Collection

```
1. User clicks browser extension "Save to Collection"
   ↓
2. Extension calls: POST /v1/collections/:id/items
   {
     type: 'link',
     url: 'https://example.com',
     title: 'Example Article'
   }
   ↓
3. API creates collection_item record
   ↓
4. API enqueues enrichment job
   ↓
5. Queue processor:
   - Fetches URL content
   - Generates summary (AI)
   - Generates tags (AI)
   - Generates embedding (AI)
   - Updates item in database
   - Upserts embedding to Vectorize
   ↓
6. Webhook delivery (if configured)
   ↓
7. Extension shows success notification
```

### Example 2: Create Newsletter from Collection

```
1. User selects collection in newsletter dashboard
   ↓
2. UI calls: POST /v1/newsletter/campaigns/from-collection
   {
     collectionId: 'col_123',
     title: 'Weekly Digest',
     filterTags: ['ai', 'research']
   }
   ↓
3. API:
   - Fetches items from collection
   - Filters by tags (if provided)
   - Creates campaign record
   - Links campaign to collection
   ↓
4. Newsletter rendering:
   - Formats each item as newsletter section
   - Includes item summary, tags, link
   - Applies newsletter template
   ↓
5. Email queue processing (existing flow)
```

### Example 3: Semantic Search Across All Content

```
1. User searches: "machine learning frameworks"
   ↓
2. API: POST /v1/search
   {
     query: "machine learning frameworks",
     type: "semantic",
     contentTypes: ["documents", "items"]
   }
   ↓
3. Backend:
   - Generates embedding for query
   - Searches Vectorize index (documents + items)
   - Searches PostgreSQL full-text (documents + items)
   - Combines results with weighted scoring
   ↓
4. Response:
   {
     documents: [...],
     items: [...],
     totalResults: 15
   }
```

## API Scopes Integration

### Existing Scopes

- `documents.read`, `documents.write`
- `apis.all`, `apis.read`

### New Scopes

- `collections.read` - Read collections and items
- `collections.write` - Create/update/delete collections and items
- `collections.search` - Perform semantic search
- `webhooks.read` - Read webhook configuration
- `webhooks.write` - Create/update webhooks

### Scope Relationships

```typescript
// If user has documents.write, they can:
// - Save documents to collections (requires collections.write)
// - Link collection items in documents

// If user has collections.write, they can:
// - Create collections
// - Add items to collections
// - But NOT create documents (requires documents.write)

// Unified search requires:
// - collections.search (for items)
// - documents.read (for documents)
```

## Browser Extension Integration

### Save Flow

```
┌─────────────┐
│   Browser   │
│   Page      │
└──────┬──────┘
       │ User clicks extension
       ▼
┌─────────────┐
│  Extension  │
│  Popup      │
└──────┬──────┘
       │ User selects collection
       ▼
┌─────────────┐
│  Extension  │
│  Background │
└──────┬──────┘
       │ POST /v1/collections/:id/items
       ▼
┌─────────────┐
│   API       │
│  Worker     │
└──────┬──────┘
       │ Creates item + enqueues job
       ▼
┌─────────────┐
│   Queue     │
│  (DO)       │
└──────┬──────┘
       │ Processes enrichment
       ▼
┌─────────────┐
│  AI Service │
│  + Vectorize│
└─────────────┘
```

### Extension Features

1. **Quick Save**: One-click save current page
2. **Text Selection**: Save selected text as snippet
3. **Image Save**: Save images from page
4. **Collection Selector**: Choose or create collection
5. **Sync Status**: Show sync status indicator

## Webhook Integration

### Event Flow

```
┌─────────────┐
│  Collection │
│   Item      │
│   Created   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   API       │
│  Worker     │
└──────┬──────┘
       │ Finds active webhooks
       ▼
┌─────────────┐
│  Webhook    │
│  Delivery   │
│   Queue     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  External   │
│  Application│
└─────────────┘
```

### Webhook Payload Example

```json
{
  "event": "item.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "item_123",
    "type": "link",
    "title": "Example Article",
    "url": "https://example.com",
    "collectionId": "col_456",
    "summary": "AI-generated summary...",
    "tags": ["ai", "research"],
    "userId": "user_789"
  }
}
```

## Migration Path

### Phase 1: Foundation (Week 1-2)

- [ ] Database schema migration
- [ ] Basic CRUD APIs (collections, items)
- [ ] Authentication & authorization

### Phase 2: AI Integration (Week 3-4)

- [ ] AI enrichment service
- [ ] Queue integration
- [ ] Vectorize setup

### Phase 3: Search & Discovery (Week 5)

- [ ] Vector search implementation
- [ ] Unified search API
- [ ] Tag system

### Phase 4: Integration (Week 6)

- [ ] Documents ↔ Collections linking
- [ ] Newsletter ↔ Collections integration
- [ ] Shared tag system

### Phase 5: Extensions (Week 7-8)

- [ ] Browser extension MVP
- [ ] Webhook system
- [ ] SDK wrappers

### Phase 6: UI & Polish (Week 9-10)

- [ ] Web UI components
- [ ] Mobile responsive
- [ ] Documentation

## Success Metrics

1. **Adoption**: % of users creating collections
2. **Engagement**: Average items per collection
3. **Search Usage**: Semantic search queries per user
4. **Integration**: Documents linked to collections
5. **Newsletter**: Campaigns created from collections
6. **API Usage**: External apps using SDK/API

## Future Enhancements

1. **Collaborative Collections**: Share collections with team
2. **Public Collections**: Discoverable public collections
3. **Collection Templates**: Pre-configured collection types
4. **AI Recommendations**: Suggested items based on existing collections
5. **Export/Import**: Export collections to various formats
6. **Mobile Apps**: Native iOS/Android apps
7. **Offline Support**: Sync when online
