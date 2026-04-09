# Build context: repository root (MegaMind/)
# The root pnpm-lock.yaml covers all workspace packages.

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk upgrade --no-cache && apk add --no-cache python3 make g++ \
    && corepack enable && corepack prepare pnpm@10.7.1 --activate

WORKDIR /app

# Copy workspace manifest + lockfile first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy the agent package manifest so pnpm resolves its deps
COPY travel-agent/package.json ./travel-agent/

# Install only travel-agent's dependencies into its package folder
RUN pnpm --dir travel-agent install --frozen-lockfile --workspace-root=false

# Copy source and build
COPY travel-agent/tsconfig.json ./travel-agent/
COPY travel-agent/src/ ./travel-agent/src/
RUN pnpm --dir travel-agent build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk upgrade --no-cache \
    && corepack enable && corepack prepare pnpm@10.7.1 --activate

WORKDIR /app

COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/travel-agent/node_modules ./travel-agent/node_modules
COPY --from=builder /app/travel-agent/dist ./travel-agent/dist
COPY travel-agent/package.json ./travel-agent/

WORKDIR /app/travel-agent

# Mount MegaMind SQLite DB at /data/ingestor.db
VOLUME ["/data"]

# ── Environment defaults ───────────────────────────────────────────────────────
ENV GEMINI_MODEL=gemini-2.0-flash
ENV MEGAMIND_DB_PATH=/data/ingestor.db
ENV QDRANT_ENABLED=true
ENV QDRANT_COLLECTION_NAME=megamind
ENV EMBEDDING_PROVIDER=gemini
ENV GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ENV EMBEDDING_VECTOR_SIZE=3072
ENV WEBHOOK_PORT=3456
ENV WEBHOOK_ENABLED=false
ENV TWITTER_APP_KEY=""
ENV TWITTER_APP_SECRET=""
ENV TWITTER_ACCESS_TOKEN=""
ENV TWITTER_ACCESS_SECRET=""
ENV TWITTER_MONITOR_HANDLE=""
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_DEFAULT_CHAT_ID=""
ENV DISCORD_BOT_TOKEN=""
ENV SLACK_BOT_TOKEN=""
ENV WHATSAPP_ACCESS_TOKEN=""
ENV WHATSAPP_PHONE_NUMBER_ID=""

EXPOSE 3456

ENTRYPOINT ["node", "dist/index.js"]
