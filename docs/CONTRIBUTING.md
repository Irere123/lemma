# Contributing Guide

Thank you for your interest in contributing to irere-brain! This guide will help you understand the queue and email systems and how to contribute effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Common Tasks](#common-tasks)

## Getting Started

### Prerequisites

- **Bun** (v1.0+) - Fast JavaScript runtime
- **Node.js** (v18+) - For compatibility
- **Git** - Version control
- **Wrangler** (v4+) - Cloudflare Workers CLI

### Knowledge Requirements

For queue/email system contributions, familiarity with:

- **TypeScript** - Type-safe JavaScript
- **Cloudflare Workers** - Serverless platform
- **Durable Objects** - Stateful serverless
- **React** (for email templates) - Component library
- **Hono** - Web framework

### Recommended Reading

Before contributing to queue/email systems:

1. [Architecture Overview](./ARCHITECTURE.md) - Understand system design
2. [Queue System](./QUEUE_SYSTEM.md) - Deep dive into queue
3. [Email Service](./EMAIL_SERVICE.md) - Email templates guide
4. [Cloudflare DO Docs](https://developers.cloudflare.com/durable-objects/)

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/irere123/irere-brain.git
cd irere-brain
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Set Up Environment

**API Environment** (`.dev.vars` in `api/` directory):

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brainos

# Resend
RESEND_API_KEY=re_your_test_key
RESEND_DOMAIN=irere.dev

# Auth (if needed)
# ...
```

### 4. Start Development Servers

```bash
# Terminal 1: API server
cd api
bun dev

# Terminal 2: Web app
cd web
bun dev

# Terminal 3: Email preview (optional)
cd packages/email
bun dev
```

### 5. Access Services

- **API**: http://localhost:4000
- **Web**: http://localhost:3000
- **Email Preview**: http://localhost:3003

## Project Structure

### Queue System Files

```
api/src/queue/
├── types.ts              # Type definitions
├── constants.ts          # Default values & prefixes
├── helpers.ts            # Key generation utilities
├── client.ts             # QueueClient (main API)
├── durable-object.ts     # Core queue logic
├── shards.ts             # Sharding system
├── bindings.ts           # Environment setup
├── index.ts              # Public exports
├── utils/
│   ├── id.ts            # ID & token generation
│   ├── time.ts          # Timestamp utilities
│   ├── backoff.ts       # Retry delay calculation
│   └── hash.ts          # Consistent hashing
└── README.md            # Queue usage guide
```

### Email Service Files

```
api/src/services/
├── email-queue.ts        # Email queue service
└── resend.ts             # Resend API wrapper

packages/email/
├── emails/
│   ├── welcome-newsletter.tsx      # Welcome template
│   └── document-newsletter.tsx     # Newsletter template
├── components/
│   ├── logo.tsx                    # Brand logo
│   ├── footer.tsx                  # Email footer
│   ├── theme.tsx                   # Theming system
│   └── ...
└── lib/
    └── constants.ts                # Shared constants
```

## Making Changes

### Workflow

1. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes**
   - Write code
   - Add tests (if applicable)
   - Update documentation

3. **Test locally**

   ```bash
   cd api
   bun run typecheck    # Check types
   ```

4. **Commit changes**

   ```bash
   git add .
   git commit -m "feat: add new queue feature"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:

```
feat(queue): add priority queue support
fix(email): resolve template rendering bug
docs(queue): update sharding documentation
refactor(queue): simplify shard selection logic
```

## Testing

### Manual Testing

#### Test Queue Operations

```typescript
// api/src/test-queue.ts
import { createEmailQueueClient } from "./queue/bindings";

export const testQueue = async (env: WorkerEnv) => {
  const client = createEmailQueueClient(env);

  // Enqueue test job
  const result = await client.enqueue("email", {
    to: "test@example.com",
    subject: "Test",
  });
  console.log("Enqueued:", result.job.id);

  // Check stats
  const stats = await client.getStats("email");
  console.log("Stats:", stats);

  // Claim job
  const jobs = await client.claim("email", 1);
  console.log("Claimed:", jobs.length);

  // Complete job
  if (jobs.length > 0) {
    await client.complete("email", jobs[0].id, jobs[0].leaseToken!);
    console.log("Completed:", jobs[0].id);
  }
};
```

Run via HTTP endpoint:

```typescript
app.get("/test/queue", async (c) => {
  await testQueue(c.env);
  return c.json({ ok: true });
});
```

#### Test Email Templates

```bash
cd packages/email
bun dev
```

Navigate to http://localhost:3003 and:

- View all templates
- Test with different props
- Check mobile rendering
- Verify links

### Integration Testing

Test complete email flow:

```typescript
// Test enqueue + process
const document = {
  id: "test-123",
  title: "Test Newsletter",
  subtitle: "Testing email flow",
  type: "NEWSLETTER" as const,
  markdown: "# Test Content",
  bannerImage: null,
  publishedDate: new Date(),
};

// Enqueue
const results = await enqueueDocumentNewsletter(env, document, [
  { email: "test@example.com", unsubscribeToken: "test-token" },
]);

// Process
const processed = await processEmailJobs(env, 10);
console.log("Results:", processed);
```

### Type Checking

```bash
cd api
bun run typecheck
```

Fix any type errors before committing.

## Code Style

### TypeScript Guidelines

**1. Use explicit types**

```typescript
// Good
const processJob = async (job: JobEnvelope): Promise<void> => {
  // ...
};

// Bad
const processJob = async (job) => {
  // ...
};
```

**2. Prefer `const` over `let`**

```typescript
// Good
const jobId = generateJobId();

// Bad
let jobId = generateJobId();
```

**3. Use readonly when appropriate**

```typescript
// Good
type Config = {
  readonly maxAttempts: number;
  readonly priority: number;
};
```

**4. Avoid `any`, use `unknown` if needed**

```typescript
// Good
const parseData = (data: unknown): JobData => {
  // Validate and parse
};

// Bad
const parseData = (data: any): JobData => {
  // ...
};
```

### React Email Guidelines

**1. Use semantic component names**

```typescript
// Good
export const WelcomeNewsletter = ({ token }: Props) => {
  /* ... */
};

// Bad
export const Email1 = (props: any) => {
  /* ... */
};
```

**2. Always define Props interface**

```typescript
interface Props {
  userName: string;
  actionUrl: string;
}

export const YourTemplate = ({ userName, actionUrl }: Props) => {
  // ...
};
```

**3. Use theme utilities**

```typescript
const themeClasses = getEmailThemeClasses();
const lightStyles = getEmailInlineStyles("light");

// Apply consistently
<Text
  className={themeClasses.text}
  style={{ color: lightStyles.text.color }}
>
  Content
</Text>
```

### Documentation Style

**1. Update docs with code changes**

- Modified queue? Update QUEUE_SYSTEM.md
- New email template? Update EMAIL_SERVICE.md
- Architecture change? Update ARCHITECTURE.md

**2. Include code examples**

```typescript
// Don't just describe, show!

// Add example usage:
const result = await client.enqueue("queue", data, options);
```

**3. Add troubleshooting sections**
If you fix a bug, document:

- What was the problem?
- How to identify it?
- How to fix it?

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Types check pass (`bun run typecheck`)
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No linter errors

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Changes Made

- List key changes
- Highlight important updates

## Testing

Describe testing performed:

- Manual tests
- Integration tests
- Edge cases verified

## Documentation

- [ ] Updated relevant documentation
- [ ] Added code examples
- [ ] Updated type definitions

## Screenshots (if applicable)

For UI/email changes, include screenshots

## Related Issues

Closes #123
```

### Review Process

1. **Automated checks** must pass
2. **Maintainer review** (1-2 business days)
3. **Address feedback** if requested
4. **Approval** required before merge
5. **Squash and merge** when ready

## Common Tasks

### Add a New Email Template

See [Email Service - Adding Templates](./EMAIL_SERVICE.md#adding-templates)

**Quick Checklist**:

1. Create `packages/email/emails/your-template.tsx`
2. Add type to `EmailTemplate` union
3. Add props to `EmailTemplateProps`
4. Add render case to `renderEmailTemplate()`
5. Create helper function (optional)
6. Test in preview server
7. Update documentation

### Add Queue Feature

**Example: Add job cancellation**

1. **Define types** (`types.ts`):

```typescript
export type CancelResponse = {
  ok: boolean;
  found: boolean;
};
```

2. **Implement in DO** (`durable-object.ts`):

```typescript
async #cancel({ jobId }: { jobId: string }) {
  // Implementation
}

// Add to handler
if (op === "cancel") {
  return this.#cancel(payload as { jobId: string });
}
```

3. **Add client method** (`client.ts`):

```typescript
async cancel(queueName: string, jobId: string) {
  const { shardSelection } = await selectShard(/* ... */);
  return dispatchToShard<CancelResponse>(
    shardSelection.stub,
    "cancel",
    { jobId }
  );
}
```

4. **Update docs** (QUEUE_SYSTEM.md):

- Add to API reference
- Add usage example
- Update troubleshooting if relevant

5. **Test thoroughly**:

```typescript
// Test cancel waiting job
// Test cancel active job (should fail)
// Test cancel non-existent job
```

### Debug Queue Issues

**Enable verbose logging**:

```typescript
const client = createEmailQueueClient(env);

// Add logging wrapper
const originalEnqueue = client.enqueue.bind(client);
client.enqueue = async (...args) => {
  console.log("Enqueue called:", args);
  const result = await originalEnqueue(...args);
  console.log("Enqueue result:", result);
  return result;
};
```

**Check DO storage directly**:

```typescript
// In Durable Object alarm or custom method
const allKeys = await this.state.storage.list();
console.log("Storage keys:", Array.from(allKeys.keys()));
```

**Monitor queue stats**:

```typescript
setInterval(async () => {
  const stats = await getEmailQueueStats(env);
  console.log(new Date().toISOString(), stats);
}, 30000); // Every 30 seconds
```

### Update Dependencies

```bash
# Update all packages
bun update

# Update specific package
bun update @react-email/components

# Check for outdated
bun outdated
```

After updating, verify:

- Types still check
- Email preview still works
- Queue operations still work

## Getting Help

### Resources

- **Documentation**: Start with docs/ directory
- **Code Examples**: See api/src/queue/README.md
- **Email Examples**: packages/email/emails/

### Ask Questions

- **GitHub Discussions**: For general questions
- **GitHub Issues**: For bugs and feature requests
- **Pull Request Comments**: For code-specific questions

### Contact

- **Email**: hello@irere.dev
- **Twitter**: @irere_emmanuel

## License

By contributing, you agree that your contributions will be licensed under AGPL-3.0.

Thank you for contributing to irere-brain! 🚀
