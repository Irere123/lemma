# syntax=docker/dockerfile:1

ARG BUN_VERSION=1.2.13
ARG TURBO_VERSION=2.7.2

FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# Install Turbo CLI
FROM base AS turbo-cli
ARG TURBO_VERSION
RUN bun add -g turbo@${TURBO_VERSION}

# Builder stage - prune API workspace
FROM turbo-cli AS builder
WORKDIR /app

COPY . .
RUN turbo prune --scope=@lemma/api --docker

# Installer stage
FROM base AS installer
WORKDIR /app

COPY --from=builder /app/out/json/ .
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/out/full/ .

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV TURBO_TELEMETRY_DISABLED=1

COPY --from=installer --chown=bun:bun /app/ ./

RUN chmod +x ./apps/api/docker-entrypoint.sh

USER bun
WORKDIR /app/apps/api

EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
