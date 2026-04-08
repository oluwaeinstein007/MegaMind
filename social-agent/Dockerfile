# Build context: repository root (MegaMind/)
# The root pnpm-lock.yaml covers all workspace packages.

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk upgrade --no-cache && apk add --no-cache python3 make g++ \
 && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifest + lockfile first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy the agent package manifest so pnpm resolves its deps
COPY social-agent/package.json ./social-agent/

# Install only social-agent's dependencies (hoisted to workspace root)
RUN pnpm install --frozen-lockfile --filter nomadsage-social-agent

# Copy source and build
COPY social-agent/tsconfig.json ./social-agent/
COPY social-agent/src/ ./social-agent/src/
RUN pnpm --filter nomadsage-social-agent build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk upgrade --no-cache \
 && corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# pnpm hoists all deps to the workspace root node_modules
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/social-agent/dist ./dist/
COPY social-agent/package.json ./

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
ENV SCHEDULER_ENABLED=false
ENV TWITTER_APP_KEY=""
ENV TWITTER_APP_SECRET=""
ENV TWITTER_ACCESS_TOKEN=""
ENV TWITTER_ACCESS_SECRET=""
ENV TWITTER_MONITOR_HANDLE=""
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_DEFAULT_CHAT_ID=""
ENV LINKEDIN_ACCESS_TOKEN=""
ENV LINKEDIN_USER_ID=""
ENV DISCORD_BOT_TOKEN=""
ENV DISCORD_DEFAULT_CHANNEL_ID=""
ENV SLACK_BOT_TOKEN=""
ENV SLACK_DEFAULT_CHANNEL=general
ENV WHATSAPP_ACCESS_TOKEN=""
ENV WHATSAPP_PHONE_NUMBER_ID=""
ENV FACEBOOK_ACCESS_TOKEN=""
ENV FACEBOOK_PAGE_ID=""
ENV INSTAGRAM_ACCESS_TOKEN=""
ENV INSTAGRAM_ACCOUNT_ID=""

EXPOSE 3456

ENTRYPOINT ["node", "dist/index.js"]
