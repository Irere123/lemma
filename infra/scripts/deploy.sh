#!/bin/bash
set -euo pipefail

# Lemma Deployment Script
# Usage: ./deploy.sh [staging|production] [version]

ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$INFRA_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Validate environment
if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
    exit 1
fi

log_info "Deploying to $ENVIRONMENT environment (version: $VERSION)"

# Check if running in Swarm mode
if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    log_error "Docker Swarm is not active. Run 'docker swarm init' first."
    log_info "Or use: ./swarm-init.sh to initialize Swarm"
    exit 1
fi

# Load environment variables
ENV_FILE="$INFRA_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
    log_info "Loading environment from $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
else
    log_warn "No .env file found at $ENV_FILE"
fi

# Set image tags
REGISTRY="${REGISTRY:-ghcr.io}"
REPO_NAME="${REPO_NAME:-emmanuelirere/lemma}"
API_IMAGE="${REGISTRY}/${REPO_NAME}/api:${VERSION}"
WORKER_IMAGE="${REGISTRY}/${REPO_NAME}/worker:${VERSION}"

log_info "API Image: $API_IMAGE"
log_info "Worker Image: $WORKER_IMAGE"

# Pull latest images
log_info "Pulling latest images..."
docker pull "$API_IMAGE" || log_warn "Could not pull API image, using local"
docker pull "$WORKER_IMAGE" || log_warn "Could not pull Worker image, using local"

# Deploy or update stack
STACK_NAME="lemma"

cd "$INFRA_DIR"

# Export image names for docker-compose.swarm.yml
export API_IMAGE="$API_IMAGE"
export WORKER_IMAGE="$WORKER_IMAGE"

if docker stack ls | grep -q "$STACK_NAME"; then
    log_info "Updating existing stack: $STACK_NAME"

    # Rolling update for API
    log_info "Rolling update for API service..."
    docker service update \
        --image "$API_IMAGE" \
        --update-parallelism 1 \
        --update-delay 10s \
        --update-order start-first \
        --update-failure-action rollback \
        --update-monitor 30s \
        "${STACK_NAME}_api" || {
            log_error "API update failed, check logs with: docker service logs ${STACK_NAME}_api"
            exit 1
        }

    # Rolling update for Worker
    log_info "Rolling update for Worker service..."
    docker service update \
        --image "$WORKER_IMAGE" \
        --update-parallelism 1 \
        --update-delay 10s \
        --update-failure-action rollback \
        --update-monitor 30s \
        "${STACK_NAME}_worker" || {
            log_error "Worker update failed, check logs with: docker service logs ${STACK_NAME}_worker"
            exit 1
        }
else
    log_info "Deploying new stack: $STACK_NAME"

    # Deploy stack using swarm-specific compose file
    docker stack deploy \
        -c docker-compose.swarm.yml \
        --with-registry-auth \
        "$STACK_NAME"

    log_info "Waiting for services to start..."
    sleep 15
fi

# Wait for services to be ready
log_info "Waiting for services to be ready..."
sleep 10

# Check service status
log_info "Service Status:"
docker service ls --filter "name=${STACK_NAME}"

# Show recent tasks
log_info "Recent API tasks:"
docker service ps "${STACK_NAME}_api" --no-trunc 2>/dev/null | head -10 || true

log_info "Recent Worker tasks:"
docker service ps "${STACK_NAME}_worker" --no-trunc 2>/dev/null | head -10 || true

# Health check
log_info "Running health check..."
sleep 5

API_HEALTHY=false
for i in {1..10}; do
    if curl -sf http://localhost:4000/ > /dev/null 2>&1; then
        API_HEALTHY=true
        break
    fi
    log_warn "API not ready yet, attempt $i/10..."
    sleep 5
done

if $API_HEALTHY; then
    log_success "API is healthy!"
else
    log_warn "API health check failed. Check logs with: docker service logs ${STACK_NAME}_api"
fi

log_success "Deployment to $ENVIRONMENT completed!"
echo ""
echo "Useful commands:"
echo "  View logs:     docker service logs -f ${STACK_NAME}_api"
echo "  View status:   docker service ps ${STACK_NAME}_api"
echo "  Scale:         docker service scale ${STACK_NAME}_api=3"
echo "  Rollback:      ./rollback.sh api"
