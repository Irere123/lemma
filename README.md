# Brain

**Your thoughts. Your API. Your rules.**

Brain is a programmable interface for your mind. It’s more than a publishing platform—it's your personal cognitive infrastructure.

## Overview

Brain is a **personal knowledge operating system** that helps you:

- Capture and organize your thoughts in structured, connected formats
- Expose your knowledge through REST and GraphQL APIs
- Publish insights via newsletters, blogs, feeds, and more
- Enable others to subscribe, query, and build on your ideas

Think of it as a public API for your brain—built for researchers, builders, and deep thinkers.

## Philosophy

**Externalized Cognition**
Make thinking transparent and accessible—structured ideas should be open to interaction.

**Knowledge as Infrastructure**
Every insight can become a service. BrainOS turns thought into composable systems.

**Open by Default**
Default to sharing while keeping fine-grained control over access and privacy.

**API-First Approach**
If it exists, it should be programmable. Every thought can be queried and used in different systems (e.g: AI Agents..).

## Getting Started

1. **Clone the Repository**

```bash
git clone https://github.com/irere123/brainos.git
cd brainos
```

2. **Install Dependencies**

```bash
pnpm install
```

3. **Configure Your Environment**

```bash
cp .env.example .env
# Set up database, email providers, and API keys
```

4. **Initialize Your Knowledge Base**

```bash
pnpm run setup
```

5. **Start the Application**

```bash
pnpm dev
```

Visit `http://localhost:3000` to begin using BrainOS.

---

## Architecture

### Knowledge Graph

All notes, ideas, and insights become nodes in a graph. Relationships are formed via tags, references, and semantic links.

### API-First Design

Your knowledge is accessible via REST and GraphQL. External apps can query, subscribe to, and integrate your ideas.

### Multi-Channel Publishing

Single source of truth distributed across:

- Blog
- Email newsletter
- APIs and feeds
- Private notes and shared collections

### Access Control

Define what is public, private, or gated. Total control over visibility.

## Features

### Thought Capture

- Markdown-native
- Bidirectional linking
- Tags and categories
- Full-text search
- Version history

### Interfaces

- REST API and GraphQL
- Webhook support
- RSS/Atom feeds
- OPML export

### Distribution

- Newsletter scheduling
- SEO-ready blog
- Private drafts
- Cross-posting integrations

### Analytics

- Knowledge graph visualization
- API usage metrics
- Subscriber engagement tracking
- Popular content analysis

---

## Use Cases

### For Researchers

- Publish and structure research
- Enable peer querying and feedback
- Evolve ideas over time

### For Builders

- Document development in real-time
- Share APIs and workflows
- Create tools and communities around your knowledge

### For Educators

- Build interactive learning paths
- Expose curriculum via APIs
- Create structured educational resources

### For Thought Leaders

- Offer knowledge as a service
- Enable others to reuse your insights
- Build knowledge-powered products

## Contributing

We welcome contributions from developers, researchers, and builders.

1. Fork the repo
2. Create a feature branch
3. Make and document your changes
4. Submit a pull request
