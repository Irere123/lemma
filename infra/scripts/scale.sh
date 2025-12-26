#!/bin/bash
set -euo pipefail

# Lemma Scale Script
# Usage: ./scale.sh <service> <replicas>

SERVICE="${1:-}"
REPLICAS="${2:-}"
STACK_NAME="lemma"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [[ -z "$SERVICE" || -z "$REPLICAS" ]]; then
    echo "Usage: $0 <service> <replicas>"
    echo ""
    echo "Services: api, worker"
    echo "Example: $0 api 3"
    echo ""
    echo "Current service status:"
    docker service ls --filter "name=${STACK_NAME}" 2>/dev/null || echo "No services found"
    exit 1
fi

# Validate replicas is a number
if ! [[ "$REPLICAS" =~ ^[0-9]+$ ]]; then
    log_error "Replicas must be a positive integer"
    exit 1
fi

FULL_SERVICE="${STACK_NAME}_${SERVICE}"

log_info "Scaling $FULL_SERVICE to $REPLICAS replicas..."

if docker service scale "$FULL_SERVICE=$REPLICAS"; then
    log_success "Scaled $FULL_SERVICE to $REPLICAS replicas"

    # Wait and show status
    sleep 3
    log_info "Service status:"
    docker service ps "$FULL_SERVICE" --no-trunc | head -$((REPLICAS + 2))
else
    log_error "Failed to scale $FULL_SERVICE"
    exit 1
fi
