# BrainOS

**Your thoughts. Your API. Your rules.**

Brain is a programmable interface for your mind. It’s more than a publishing platform it's your personal cognitive infrastructure.

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
git clone https://github.com/irere123/brain.git
cd brain
```

2. **Install Dependencies**

```bash
bun install
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
bun dev
```

Visit `http://localhost:3000` to begin using BrainOS.

## Architecture

### API-First Design

Your knowledge is accessible via REST and GraphQL. External apps can query, subscribe to, and integrate your ideas.

### Write once, publish anywhere.

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
- Tags and categories
- Full-text search
- Version history

### Interfaces

- REST API and GraphQL
- Webhook support

### Distribution

- Newsletter scheduling
- SEO-ready blog
- Private drafts

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
