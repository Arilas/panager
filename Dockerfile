# Dockerfile for testing Panager Linux build
# Supports both development and production builds

FROM ubuntu:22.04 AS base

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for Tauri on Linux
RUN apt-get update && apt-get install -y \
    # Build essentials
    build-essential \
    curl \
    wget \
    git \
    pkg-config \
    # GTK and WebKit dependencies
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    # Additional Tauri dependencies
    libssl-dev \
    libxdo-dev \
    libsoup-3.0-dev \
    # For global shortcuts (X11)
    libxcb1-dev \
    libxcb-render0-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    # For git2 crate (SSH support)
    libssh2-1-dev \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN rustc --version && cargo --version && node --version && npm --version

WORKDIR /app

# -----------------------------------------------------------
# Development stage - for iterative development
# -----------------------------------------------------------
FROM base AS dev

# Install additional dev tools
RUN cargo install tauri-cli

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

# Copy Rust dependencies
COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/

# Pre-build Rust dependencies (creates a dummy main.rs)
RUN mkdir -p src-tauri/src && \
    echo "fn main() {}" > src-tauri/src/main.rs && \
    cd src-tauri && cargo fetch

# Now copy the actual source code
COPY . .

# Default command for development
CMD ["npm", "run", "tauri", "dev"]

# -----------------------------------------------------------
# Build stage - for production builds
# -----------------------------------------------------------
FROM base AS builder

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

# Copy everything
COPY . .

# Build the application
RUN npm run tauri build

# -----------------------------------------------------------
# Test stage - for running checks and tests
# -----------------------------------------------------------
FROM base AS test

COPY package*.json ./
RUN npm ci

COPY . .

# Run Rust checks
RUN cd src-tauri && cargo check
RUN cd src-tauri && cargo clippy -- -D warnings
RUN cd src-tauri && cargo test

# Run frontend checks (TypeScript compilation check via build)
RUN npm run build

CMD ["echo", "All tests passed!"]

# -----------------------------------------------------------
# Artifacts stage - extract built binaries
# -----------------------------------------------------------
FROM ubuntu:22.04 AS artifacts

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-0 \
    libgtk-3-0 \
    libayatana-appindicator3-1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/src-tauri/target/release/bundle/deb/*.deb ./
COPY --from=builder /app/src-tauri/target/release/bundle/appimage/*.AppImage ./

CMD ["ls", "-la"]
