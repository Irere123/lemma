#!/bin/bash
set -euo pipefail

# Lemma Swarm Initialization Script
# Usage: ./swarm-init.sh [manager|worker] [manager-ip]

MODE="${1:-manager}"
MANAGER_IP="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if already in swarm mode
if docker info 2>/dev/null | grep -q "Swarm: active"; then
    log_warn "Docker Swarm is already active"
    docker info 2>/dev/null | grep -A 20 "Swarm:" | head -10
    exit 0
fi

case "$MODE" in
    manager)
        log_info "Initializing Docker Swarm as manager node..."

        # Get advertise address
        if [[ -z "$MANAGER_IP" ]]; then
            MANAGER_IP=$(hostname -I | awk '{print $1}')
        fi

        docker swarm init --advertise-addr "$MANAGER_IP"

        log_success "Swarm initialized successfully!"

        # Display join tokens
        echo ""
        log_info "To add a worker node, run this command on the worker:"
        docker swarm join-token worker

        echo ""
        log_info "To add another manager node, run this command on the new manager:"
        docker swarm join-token manager
        ;;

    worker)
        if [[ -z "$MANAGER_IP" ]]; then
            log_error "Manager IP is required for worker mode"
            echo "Usage: $0 worker <manager-ip>"
            exit 1
        fi

        log_info "To join as a worker, get the join token from the manager:"
        echo "  ssh user@$MANAGER_IP 'docker swarm join-token worker -q'"
        echo ""
        echo "Then run:"
        echo "  docker swarm join --token <TOKEN> $MANAGER_IP:2377"
        ;;

    *)
        log_error "Unknown mode: $MODE"
        echo "Usage: $0 [manager|worker] [manager-ip]"
        exit 1
        ;;
esac

# Create default networks
log_info "Creating overlay networks..."
docker network create --driver overlay --attachable lemma-network 2>/dev/null || true

# Verify swarm status
log_info "Swarm Status:"
docker node ls

log_success "Swarm setup completed!"
echo ""
echo "Next steps:"
echo "  1. Deploy the stack: cd $INFRA_DIR && ./scripts/deploy.sh staging"
echo "  2. View services:    docker service ls"
echo "  3. View nodes:       docker node ls"
