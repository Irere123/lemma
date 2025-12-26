#!/bin/bash
set -euo pipefail

# Lemma Rollback Script
# Usage: ./rollback.sh [api|worker|all]

SERVICE="${1:-all}"
STACK_NAME="lemma"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

rollback_service() {
    local service_name="$1"
    local full_name="${STACK_NAME}_${service_name}"

    log_info "Rolling back $full_name to previous version..."

    # Get current and previous image
    CURRENT_IMAGE=$(docker service inspect "$full_name" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "unknown")
    log_info "Current image: $CURRENT_IMAGE"

    # Perform rollback
    if docker service update --rollback "$full_name"; then
        log_success "$full_name rolled back successfully!"

        NEW_IMAGE=$(docker service inspect "$full_name" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "unknown")
        log_info "Rolled back to: $NEW_IMAGE"

        # Show task status
        log_info "Service tasks:"
        docker service ps "$full_name" --no-trunc | head -5
    else
        log_error "Failed to rollback $full_name"
        return 1
    fi
}

case "$SERVICE" in
    api)
        rollback_service "api"
        ;;
    worker)
        rollback_service "worker"
        ;;
    all)
        log_info "Rolling back all services..."
        rollback_service "api"
        rollback_service "worker"
        ;;
    *)
        log_error "Unknown service: $SERVICE"
        echo "Usage: $0 [api|worker|all]"
        exit 1
        ;;
esac

log_success "Rollback completed!"

# Show final status
echo ""
log_info "Current service status:"
docker service ls --filter "name=${STACK_NAME}"
