# Lemma Infrastructure

Production infrastructure for the Lemma API.

## Services

| Service    | Description                          | Port  |
|------------|--------------------------------------|-------|
| `api`      | Main Hono API server                 | 4000  |
| `worker`   | Background job workers (BullMQ)      | -     |
| `postgres` | PostgreSQL database                  | 5432  |
| `redis`    | Redis for job queues                 | 6379  |

## Quick Start

### Development

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your values
vim .env

# Start all services
make up

# View logs
make logs

# Run migrations
make migrate
```

### Production

```bash
# Start with production config
make prod-up

# View logs
make prod-logs

# Stop services
make prod-down
```

## Commands

Run `make help` to see all available commands.

## Environment Variables

See `.env.example` for all required environment variables.

### Required for Production

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `LEMMA_ENCRYPTION_KEY` - 32-byte hex encryption key
- `BETTER_AUTH_SECRET` - Auth secret key
- `RESEND_API_KEY` - Resend email API key
- `R2_*` - Cloudflare R2 storage credentials

## Scaling

### API Server

The API is stateless and can be scaled horizontally:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

### Background Workers

Scale workers based on email volume:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=3
```

## Health Checks

```bash
# Check all services
make health

# API endpoint
curl http://localhost:4000/

# Redis
docker-compose exec redis redis-cli ping

# PostgreSQL
docker-compose exec postgres pg_isready -U lemma
```

## Logs

```bash
# All services
make logs

# Specific service
make logs-api
make logs-worker

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
```

## Backup

### PostgreSQL

```bash
# Backup
docker-compose exec postgres pg_dump -U lemma lemma > backup.sql

# Restore
cat backup.sql | docker-compose exec -T postgres psql -U lemma lemma
```

### Redis

Redis data is persisted with AOF. Backup the volume:

```bash
docker run --rm -v lemma_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```
