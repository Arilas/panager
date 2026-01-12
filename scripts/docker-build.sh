#!/bin/bash
# Build script for Panager Linux build using Docker
#
# Usage:
#   ./scripts/docker-build.sh check    # Run cargo check
#   ./scripts/docker-build.sh test     # Run all tests
#   ./scripts/docker-build.sh build    # Build production binaries
#   ./scripts/docker-build.sh dev      # Interactive development shell
#   ./scripts/docker-build.sh clean    # Clean up Docker resources

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}==>${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

# Check if docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        echo "Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
}

# Check if docker compose is available (v2 or v1)
get_compose_cmd() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    elif command -v docker-compose &> /dev/null; then
        echo "docker-compose"
    else
        print_error "Docker Compose is not available"
        echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
}

case "${1:-help}" in
    check)
        check_docker
        COMPOSE_CMD=$(get_compose_cmd)
        print_status "Running cargo check..."
        $COMPOSE_CMD run --rm check
        print_status "Cargo check completed successfully!"
        ;;

    test)
        check_docker
        COMPOSE_CMD=$(get_compose_cmd)
        print_status "Running tests..."
        $COMPOSE_CMD run --rm test
        print_status "All tests completed!"
        ;;

    build)
        check_docker
        COMPOSE_CMD=$(get_compose_cmd)
        print_status "Building production binaries..."
        $COMPOSE_CMD run --rm build
        print_status "Build completed! Artifacts are in ./build-output/"
        ls -la build-output/ 2>/dev/null || print_warning "No build output found"
        ;;

    dev)
        check_docker
        COMPOSE_CMD=$(get_compose_cmd)
        print_status "Starting development shell..."
        $COMPOSE_CMD run --rm dev
        ;;

    clean)
        check_docker
        COMPOSE_CMD=$(get_compose_cmd)
        print_status "Cleaning up Docker resources..."
        $COMPOSE_CMD down --volumes --remove-orphans
        docker image prune -f
        rm -rf build-output/
        print_status "Cleanup completed!"
        ;;

    help|--help|-h)
        echo "Panager Docker Build Script"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  check    Run cargo check to verify code compiles"
        echo "  test     Run all tests (cargo check, clippy, cargo test)"
        echo "  build    Build production binaries (deb, AppImage)"
        echo "  dev      Start interactive development shell"
        echo "  clean    Clean up Docker resources and build output"
        echo "  help     Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 check     # Quick syntax check"
        echo "  $0 build     # Full production build"
        echo ""
        ;;

    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac
