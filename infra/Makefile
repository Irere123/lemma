# Lemma Infrastructure Makefile

.PHONY: help build up down logs shell migrate clean deploy rollback scale swarm-init

# Default target
help:
	@echo "Lemma Infrastructure Commands"
	@echo ""
	@echo "Development:"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - View logs (all services)"
	@echo "  make logs-api    - View API logs"
	@echo "  make logs-worker - View worker logs"
	@echo "  make shell-api   - Shell into API container"
	@echo "  make shell-db    - Shell into PostgreSQL"
	@echo "  make shell-redis - Shell into Redis"
	@echo ""
	@echo "Production (Docker Compose):"
	@echo "  make prod-up     - Start production services"
	@echo "  make prod-down   - Stop production services"
	@echo ""
	@echo "Swarm Deployment:"
	@echo "  make swarm-init  - Initialize Docker Swarm"
	@echo "  make deploy      - Deploy to staging (Swarm)"
	@echo "  make deploy-prod - Deploy to production (Swarm)"
	@echo "  make rollback    - Rollback all services"
	@echo "  make rollback-api    - Rollback API service"
	@echo "  make rollback-worker - Rollback Worker service"
	@echo "  make scale-api N=3   - Scale API to N replicas"
	@echo "  make scale-worker N=2- Scale Worker to N replicas"
	@echo "  make swarm-status    - Show Swarm service status"
	@echo ""
	@echo "Database:"
	@echo "  make migrate     - Run database migrations"
	@echo "  make db-reset    - Reset database (DESTRUCTIVE)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make build       - Build Docker images"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make prune       - Remove unused Docker resources"

# Development
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

logs-api:
	docker-compose logs -f api

logs-worker:
	docker-compose logs -f worker

shell-api:
	docker-compose exec api sh

shell-db:
	docker-compose exec postgres psql -U $${POSTGRES_USER:-lemma} -d $${POSTGRES_DB:-lemma}

shell-redis:
	docker-compose exec redis redis-cli

# Production
prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

prod-logs:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Database
migrate:
	docker-compose exec api bun run api/scripts/migrate.ts

db-reset:
	@echo "WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " confirm; \
	if [ "$$confirm" = "y" ]; then \
		docker-compose down -v; \
		docker-compose up -d postgres redis; \
		sleep 5; \
		docker-compose up -d api worker; \
	fi

# Maintenance
clean:
	docker-compose down -v --remove-orphans

prune:
	docker system prune -f
	docker volume prune -f

# Health check
health:
	@echo "Checking services..."
	@docker-compose ps
	@echo ""
	@echo "API Health:"
	@curl -s http://localhost:4000/ | head -c 100 || echo "API not responding"
	@echo ""
	@echo "Redis:"
	@docker-compose exec -T redis redis-cli ping || echo "Redis not responding"
	@echo ""
	@echo "PostgreSQL:"
	@docker-compose exec -T postgres pg_isready -U $${POSTGRES_USER:-lemma} || echo "PostgreSQL not responding"

# Swarm Deployment
swarm-init:
	./scripts/swarm-init.sh

deploy:
	./scripts/deploy.sh staging

deploy-prod:
	./scripts/deploy.sh production

rollback:
	./scripts/rollback.sh all

rollback-api:
	./scripts/rollback.sh api

rollback-worker:
	./scripts/rollback.sh worker

scale-api:
	./scripts/scale.sh api $${N:-2}

scale-worker:
	./scripts/scale.sh worker $${N:-2}

swarm-status:
	@echo "=== Swarm Nodes ==="
	@docker node ls 2>/dev/null || echo "Not in swarm mode"
	@echo ""
	@echo "=== Services ==="
	@docker service ls --filter "name=lemma" 2>/dev/null || echo "No services found"
	@echo ""
	@echo "=== API Tasks ==="
	@docker service ps lemma_api --no-trunc 2>/dev/null | head -10 || true
	@echo ""
	@echo "=== Worker Tasks ==="
	@docker service ps lemma_worker --no-trunc 2>/dev/null | head -10 || true

swarm-logs-api:
	docker service logs -f lemma_api

swarm-logs-worker:
	docker service logs -f lemma_worker

# Build images for deployment
build-images:
	docker build -t lemma-api:latest -f ../api/Dockerfile ..
	docker build -t lemma-worker:latest -f docker/worker.Dockerfile ..
