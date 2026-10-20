# Editor end-to-end checks

Node + Playwright scripts that run the editor against a real local stack. CI
runs them in the `e2e` job (`.github/workflows/ci.yaml`); each exits non-zero
on any failed check.

| Script | What must hold |
|---|---|
| `durability.mjs` | Two tabs, a slow uplink, offline + close, a crash right after typing, closing mid-save and an update lost in transit all end with every character on the server. Opening a document writes nothing. |
| `foundations.mjs` | Every block has a stable id (new/split/pasted blocks get fresh ones); editors older or newer than the document's schema are turned away; one undo history across title, subtitle and body; revision history captures large deletions, restores, and publishes, owner-only. |
| `editor-ui.mjs` | The block handle and its menu (duplicate with a fresh id, move, turn into, delete), + opening the grouped slash menu, ⌘K and the link popover, code language, image size and alt text, table rows, callout icon, and Enter/↑ between title, subtitle and body. Each ends on what the server holds. |
| `latency.mjs` | Typing cost stays flat from 1k to 100k words (editor-only page, no backend). Re-creating the Phase A bug with `INJECT_REGRESSION=1` makes it fail. |

## Running locally

```sh
# 1. API with a fresh local database
cd apps/api && bun run migrate:local
bunx wrangler dev --env local --port 4000 --var BETTER_AUTH_SECRET:local-only-auth-secret-0123456789abcdef

# 2. Web app built against it
VITE_PUBLIC_BACKEND_URL=http://localhost:4000 VITE_PUBLIC_APP_URL=http://localhost:5173 bunx turbo build --filter=web
cd apps/web && bunx vite preview --port 5173

# 3. Checks (from apps/web; `npx playwright install chromium` once)
node e2e/durability.mjs
node e2e/foundations.mjs
node e2e/editor-ui.mjs
bun run bench:build && node e2e/latency.mjs
```

The scripts create an `e2e-writer@example.test` account on first use and mark
it verified in the local database. Set `E2E_PERSIST_TO` if the API was started
with `--persist-to`.
