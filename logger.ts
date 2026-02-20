FROM node:22-slim

# Install essential tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

# Create agent workspace
WORKDIR /hydra

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Create data directory
RUN mkdir -p /root/.hydra

# Expose ports for API services (Forge engine)
EXPOSE 3000-3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Default command
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--run"]
