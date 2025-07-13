FROM oven/bun:1.2.13-slim

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/email/package.json ./packages/email/
COPY web/package.json ./web/package.json
COPY api/package.json ./api/

# Install using bun's workspace command
RUN bun install --filter ./api   

COPY api ./api
COPY packages/email ./packages/email

EXPOSE 3000
ENTRYPOINT ["bun", "run", "api/src/index.ts"]