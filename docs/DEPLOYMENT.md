# Deployment & secrets

Both apps run on Cloudflare Workers and are deployed with Wrangler. CI/CD is a
single GitHub Actions pipeline. This document describes how deploys are
triggered and—most importantly—**what is public config vs. what is a secret**.

## Environment

There is **one deployed environment**. The Wrangler env key is `staging`, but it
carries the **production (customer-facing) config** — that is what customers
use. The `local` env exists only for local dev (`bun run dev`).

> Why the name: the git branch and the pipeline deploy with `--env staging`, so
> the live config lives under the `staging` key. The resources it points at are
> the real production ones (`lemma-api` on `api.irere.dev`, `lemma-production`
> D1, etc.).

| App | Wrangler env | Worker     | Domain            | D1 / KV / R2 / Queues prefix |
| --- | ------------ | ---------- | ----------------- | ---------------------------- |
| API | `staging`    | `lemma-api`| `api.irere.dev`   | `lemma-production*`          |
| Web | `staging`    | `brainos`  | `lemma.irere.dev` | — (no runtime state)         |

Pull requests run **CI only** (no deploy). Pushing to `staging` runs CI and then
deploys whichever app changed (path-filtered).

## Pipeline

One workflow, **`.github/workflows/ci.yaml`** (`CI/CD`), with four jobs:

| Job          | Runs on              | What it does                                                                          |
| ------------ | -------------------- | ------------------------------------------------------------------------------------- |
| `ci`         | PR + push `staging`  | `turbo build` + type-check API/packages (blocking); lint + web type-check (advisory)  |
| `changes`    | push, after CI green | Detects which app changed (`dorny/paths-filter`) so only needed deploys run           |
| `deploy-api` | api changed          | `bun install` → apply D1 migrations → `wrangler deploy --env staging`                  |
| `deploy-web` | web changed          | `bun install` → `turbo build --filter=web` → `wrangler deploy --env staging`           |

Deploys are gated on a green `ci` (`needs:`), never run on PRs, and never run a
redundant type-check of their own. The API deploy does **not** type-check again
(CI already did). Docs-only commits skip the whole pipeline (`paths-ignore`).

### Root orchestration via Turborepo

CI never runs per-app `--cwd` build commands. Everything goes through Turbo from
the repo root so workspace packages build in dependency order and nothing builds
against a stale or missing dependency:

- `bun run build` → `turbo build` builds `@lemma/headless` (its gitignored
  `dist/` is consumed by `web`) **before** `web`. A bare `vite build` would not,
  which is the class of breakage this setup avoids.
- `bunx turbo typecheck --filter='!web'` type-checks the API and shared packages
  (the blocking gate). `--filter=web` is run separately as an advisory check.
- The task name is `typecheck` everywhere (`turbo.json` + each workspace), and
  `typecheck` `dependsOn ^build` so a package is type-checked against its
  dependencies' emitted declarations.
- `@lemma/email`'s react-email preview build is exposed as `preview:build` (not
  `build`) so it stays out of the Turbo build graph — nothing consumes its
  output (the API imports `@lemma/email` as source), and it is flaky to build.

## GitHub configuration

### 1. Environment secrets

Only **deploy credentials** belong in GitHub. Add these to the `staging` GitHub
Environment (Settings → Environments):

| Secret                  | Used for                     |
| ----------------------- | ---------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Wrangler auth for deploy + D1 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account            |

**Cloudflare API token scopes** (My Profile → API Tokens → Create Token):
`Workers Scripts:Edit`, `Workers KV Storage:Edit`, `Workers R2 Storage:Edit`,
`D1:Edit`, `Account Settings:Read`. Scope it to the single account. The token
**must** have `D1:Edit` on the account that owns `lemma-production`, or the
`Apply D1 migrations` step fails with `code: 7403` (not authorized).

### 2. GitHub Environment

Create the `staging` environment and attach the token secrets to it. The deploy
jobs reference `environment: staging`. Add **required reviewers** there if you
want deploys to need manual approval.

## Configuration model — public vs. secret

The golden rule: **public config lives in `wrangler.jsonc` `vars` (committed);
secrets are Cloudflare Worker secrets (never committed, never in CI).**

### Public (committed in `wrangler.jsonc` → `vars`)

- API: `ENV`, `ALLOWED_API_ORIGINS`, `BASE_URL`, `FRONTEND_URL`,
  `BETTER_AUTH_URL`, `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_URL`,
  `R2_STORAGE_BASE_URL`, `RESEND_DOMAIN`.
- Web: `VITE_PUBLIC_BACKEND_URL`, `VITE_PUBLIC_APP_URL` (these are baked into the
  client bundle — they are public by definition; never put a secret behind a
  `VITE_PUBLIC_` name).

The web app has **no runtime secrets**.

### Secret (Cloudflare Worker secrets — API only)

Never committed. Set on the `staging` env:

- `BETTER_AUTH_SECRET`
- `LEMMA_ENCRYPTION_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `RESEND_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SENTRY_DSN` *(optional)*, `SENTRY_RELEASE` *(optional)*

> The `local` env in `apps/api/wrangler.jsonc` contains **placeholder** values for
> these names so local dev works with zero config. They are fake — never put real
> secrets there. For real local secrets use `apps/api/.dev.vars` (gitignored;
> see `.dev.vars.example`).

## Setting Worker secrets (run once)

Secrets persist across deploys, so this is a one-time setup (and whenever a value
rotates). They never flow through CI.

```sh
cd apps/api
for NAME in BETTER_AUTH_SECRET LEMMA_ENCRYPTION_KEY R2_ACCESS_KEY_ID \
            R2_SECRET_ACCESS_KEY RESEND_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  bunx wrangler secret put "$NAME" --env staging
done

# verify
bunx wrangler secret list --env staging
```

## Local development

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in real values (optional)
bun install
bun run dev
```

`.dev.vars` is gitignored and overrides the `local` placeholders in
`wrangler.jsonc`.

## Known gaps / follow-ups

- **`ALLOWED_API_ORIGINS` is missing from the `staging` (production) `vars`** but
  is **required** by `src/env.ts` (`z.string()`). The worker throws
  `Invalid environment variables` on boot until it is added. Add it as public
  config — e.g. `"ALLOWED_API_ORIGINS": "https://lemma.irere.dev"` (the
  customer web origin) — before relying on the deploy.
- The web route is `lemma.irere.dev` while `VITE_PUBLIC_APP_URL` is
  `https://irere.dev` — reconcile these to the real customer domain.
- `ENV` only accepts `local | production`, so the live env runs with `ENV:
  "production"`. There is no distinct `staging` mode.
- The old per-stage resources (`lemma-api-staging`, `brain-staging`, the
  `lemma-staging` D1/KV, `lemma-staging-*` queues/buckets) are now **orphaned**
  and can be deleted from Cloudflare.
- **Lint (Biome) and web type-check are advisory** in CI (`continue-on-error`)
  because of pre-existing violations (a stray `react-router` import in
  `src/hooks/use-nprogress.ts` and ~68 `TS6307` project-reference errors). Fix
  those, then drop `continue-on-error` and fold `--filter=web` into the blocking
  type-check.
- **Bun is pinned to `1.3.14`** (`package.json` `packageManager` + every
  `setup-bun` step). Do not downgrade to `1.2.x`: bun `1.2.2` has a `catalog:`
  resolution bug that breaks `bun install`. CI uses `--frozen-lockfile`, so
  regenerate and commit `bun.lock` whenever dependencies change.
