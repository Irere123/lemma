# API

This package deploys as a Cloudflare Worker. The only configured Worker
environments are `staging` and `production`.

Useful commands:

```sh
bun run cf-typegen
bun run typecheck
bun run deploy:staging
bun run deploy:production
```
