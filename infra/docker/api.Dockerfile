FROM oven/bun:1.2.13-slim

WORKDIR /app

# Copy only package files first
COPY package.json bun.lock ./
COPY packages/email/package.json ./packages/email/
COPY api/package.json ./api/

# Install dependencies
RUN bun install --filter '@brain/api'

# Copy source files
COPY api ./api
COPY packages/email ./packages/email

EXPOSE 3000

ENTRYPOINT ["bun", "run", "api/src/index.ts"]