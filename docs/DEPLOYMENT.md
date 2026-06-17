# Deployment & secrets

Both apps run on Cloudflare Workers and are deployed with Wrangler. CI/CD is
GitHub Actions. This document describes how deploys are triggered and—most
importantly—**what is public config vs. what is a secret**.

## Environments & branch mapping

| Branch    | Deploys to   | API worker          | Web worker      | API domain        | Web domain          |
| --------- | ------------ | ------------------- | --------------- | ----------------- | ------------------- |
| `staging` | `staging`    | `lemma-api-staging` | `brain-staging` | `sapi.irere.dev`  | `staging.irere.dev` |
| `main`    | `production` | `lemma-api`         | `brainos`       | `api.irere.dev`   | `lemma.irere.dev`   |

Pull requests run **CI only** (no deploy). Pushing to `staging` or `main`
triggers the deploy workflows for whichever app changed (path-filtered).

> `main` does not exist yet — create it from `staging` when you are ready to cut
> a production line, and set it as a protected branch.

## Workflows

| Workflow             | Trigger                              | What it does                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------------- |
| `ci.yaml`            | PR + push to `staging`/`main`        | Type-check API, build web (blocking); lint + web type-check (advisory) |
| `deploy-api.yaml`    | push to `staging`/`main` (api paths) | Type-check → apply D1 migrations → `wrangler deploy`     |
| `deploy-web.yaml`    | push to `staging`/`main` (web paths) | Build → `wrangler deploy`                                |

The target env is derived from the branch: `main → production`, otherwise
`staging`.

## GitHub configuration

### 1. Repository / environment secrets

Only **deploy credentials** belong in GitHub. Add these as secrets on the
`production` and `staging` GitHub Environments (Settings → Environments):

| Secret                  | Used for                          |
| ----------------------- | --------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Wrangler auth for deploy + D1      |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account                |

**Cloudflare API token scopes** (My Profile → API Tokens → Create Token):
`Workers Scripts:Edit`, `Workers KV Storage:Edit`, `Workers R2 Storage:Edit`,
`D1:Edit`, `Account Settings:Read`. Scope it to the single account.

### 2. GitHub Environments (recommended)

Create `production` and `staging` environments and attach the token secrets to
each. Add **required reviewers** to `production` so prod deploys need manual
approval. The workflows already set `environment:` based on the branch.

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

Never committed. Set per environment:

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

## Setting Worker secrets (run once per environment)

Secrets persist across deploys, so this is a one-time setup (and whenever a value
rotates). They never flow through CI.

```sh
cd apps/api
for NAME in BETTER_AUTH_SECRET LEMMA_ENCRYPTION_KEY R2_ACCESS_KEY_ID \
            R2_SECRET_ACCESS_KEY RESEND_API_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  bunx wrangler secret put "$NAME" --env production   # or --env staging
done

# verify
bunx wrangler secret list --env production
```

## Provisioning the staging API (one-time)

The `staging` env in `apps/api/wrangler.jsonc` has placeholder resource IDs.
Create the resources and paste the IDs in:

```sh
cd apps/api
bunx wrangler d1 create lemma-staging                 # -> database_id
bunx wrangler kv namespace create CACHE-staging       # -> id
bunx wrangler r2 bucket create lemma-staging-assets
for q in email newsletter analytics scheduled; do
  bunx wrangler queues create lemma-staging-$q
  bunx wrangler queues create lemma-staging-$q-dlq
done
```

Replace `REPLACE_WITH_STAGING_D1_ID` and `REPLACE_WITH_STAGING_KV_ID`, set the
staging Worker secrets (above), then `bun run migrate:staging`. Add the
`sapi.irere.dev` and `staging.irere.dev` custom domains to the account.

## Production go-live checklist

- [ ] Create the `main` branch and protect it (require PR + CI + reviewer).
- [ ] Add `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` to both GitHub Environments.
- [ ] Set all Worker secrets for `production` (and `staging`).
- [ ] **Verify `ALLOWED_API_ORIGINS` is present for production** — it is required
      by `src/env.ts` but is *not* currently in the production `vars`; add it (it
      is public config) or the worker will fail to boot.
- [ ] First prod deploy runs migrations automatically; for a manual run use
      `bun run --cwd apps/api migrate:production`.

## Local development

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in real values (optional)
bun install
bun run dev
```

`.dev.vars` is gitignored and overrides the `local` placeholders in
`wrangler.jsonc`.

## Known gaps / follow-ups

- **Lint (Biome) and web type-check are advisory** in CI (`continue-on-error`)
  because of pre-existing violations. Fix them, then drop `continue-on-error`
  and mark them required.
- The web `production` route is `lemma.irere.dev` while `VITE_PUBLIC_APP_URL`
  is `https://irere.dev` — reconcile these to the real production domain.
- Consider whether `ENV` should gain a distinct `staging` value (it currently
  reuses `production` behavior on the staging worker).
