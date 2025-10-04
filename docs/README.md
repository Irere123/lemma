# irere-brain Documentation

Welcome to the irere-brain project documentation. This documentation is designed to help contributors understand the system architecture and contribute effectively.

## 📚 Documentation Index

### Core Systems

1. **[Architecture Overview](./ARCHITECTURE.md)** - System design and components
2. **[Queue System](./QUEUE_SYSTEM.md)** - Job queue implementation with Durable Objects
3. **[Email Service](./EMAIL_SERVICE.md)** - Email sending with React Email templates

### Getting Started

4. **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project

## 🎯 Project Overview

irere-brain is a full-stack blogging platform built with:

- **Frontend**: React + TanStack Router + Vite
- **Backend**: Cloudflare Workers + Hono + tRPC
- **Database**: PostgreSQL (via Cloudflare Hyperdrive)
- **Queue**: Custom Durable Objects-based job queue
- **Email**: Resend + React Email templates
- **Storage**: Cloudflare KV + Durable Objects

## 🏗️ Project Structure

```
irere-brain/
├── api/                    # Backend API (Cloudflare Workers)
│   ├── src/
│   │   ├── queue/         # Job queue system
│   │   ├── services/      # Business logic services
│   │   ├── db/            # Database queries & schema
│   │   ├── rest/          # REST API routes
│   │   └── trpc/          # tRPC routes
│   └── wrangler.jsonc     # Cloudflare config
├── packages/
│   └── email/             # React Email templates
│       ├── emails/        # Email templates
│       └── components/    # Reusable email components
├── web/                   # Frontend application
└── docs/                  # Documentation (you are here)
```

## 🚀 Key Features

### 1. Job Queue System

A production-ready job queue system built on Cloudflare Durable Objects:

- **Horizontal scaling** via sharding
- **Automatic retries** with configurable backoff strategies
- **Priority queues** for job ordering
- **Delayed jobs** for scheduled execution
- **Dead letter queue** for failed jobs
- **Atomic operations** for consistency

[Read more →](./QUEUE_SYSTEM.md)

### 2. Email Service

Template-based email system using React Email:

- **Type-safe templates** with TypeScript
- **Document newsletter** integration
- **Welcome emails** with verification
- **Batch sending** to multiple recipients
- **Unsubscribe support**
- **Automatic retry** on failures

[Read more →](./EMAIL_SERVICE.md)

## 🛠️ Tech Stack Details

### Backend

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: Hono (fast web framework)
- **API**: tRPC for type-safe APIs + OpenAPI for REST
- **Database**: PostgreSQL with Drizzle ORM
- **Queue**: Custom Durable Objects implementation
- **Storage**: KV for metadata, Durable Objects for state

### Frontend

- **Framework**: React 18
- **Router**: TanStack Router (type-safe routing)
- **Styling**: TailwindCSS + Shadcn UI
- **State**: Zustand + TanStack Query
- **Editor**: Slate.js for rich text editing

### Email

- **Rendering**: React Email (JSX → HTML)
- **Delivery**: Resend API
- **Templates**: TypeScript + Tailwind

## 📖 Quick Links

- [Queue System Architecture](./QUEUE_SYSTEM.md#architecture)
- [How to Add Email Templates](./EMAIL_SERVICE.md#adding-templates)
- [Durable Object Sharding](./QUEUE_SYSTEM.md#sharding)
- [Contributing Guidelines](./CONTRIBUTING.md)

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting PRs.

### Development Setup

```bash
# Install dependencies
bun install

# Start development servers
cd api && bun dev        # API server
cd web && bun dev        # Web app
cd packages/email && bun dev  # Email preview
```

## 📝 Documentation Standards

When contributing documentation:

1. **Use clear headings** - Make it scannable
2. **Include code examples** - Show, don't just tell
3. **Add diagrams** - Visual aids help understanding
4. **Keep it updated** - Update docs with code changes
5. **Link related docs** - Cross-reference related topics

## 🔗 External Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [React Email Docs](https://react.email/)
- [Hono Framework](https://hono.dev/)
- [tRPC Documentation](https://trpc.io/)

## 📄 License

This project is licensed under AGPL-3.0. See the LICENSE file for details.
