# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

# Install build tools required by native deps (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts=false

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Install runtime libs for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled output and production deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

# ── Data volume ───────────────────────────────────────────────────────────────
# The agent reads MegaMind's SQLite DB.  Mount it at /data/ingestor.db and set:
#   MEGAMIND_DB_PATH=/data/ingestor.db
VOLUME ["/data"]

# ── Environment defaults ───────────────────────────────────────────────────────
# All secrets are injected at runtime via --env-file or -e flags.
# See .env.example for the full list.

# Gemini
ENV GEMINI_MODEL=gemini-2.0-flash

# MegaMind DB (override with the volume path)
ENV MEGAMIND_DB_PATH=/data/ingestor.db

# Qdrant (cloud — override via .env)
ENV QDRANT_ENABLED=true
ENV QDRANT_COLLECTION_NAME=megamind

# Embedding
ENV EMBEDDING_PROVIDER=gemini
ENV GEMINI_EMBEDDING_MODEL=gemini-embedding-001
ENV EMBEDDING_VECTOR_SIZE=3072

# Webhook / Scheduler
ENV WEBHOOK_PORT=3456
ENV WEBHOOK_ENABLED=false
ENV SCHEDULER_ENABLED=false

# ── Platforms ─────────────────────────────────────────────────────────────────
# Twitter / X
ENV TWITTER_APP_KEY=""
ENV TWITTER_APP_SECRET=""
ENV TWITTER_ACCESS_TOKEN=""
ENV TWITTER_ACCESS_SECRET=""
ENV TWITTER_MONITOR_HANDLE=""

# Telegram
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_DEFAULT_CHAT_ID=""

# LinkedIn
ENV LINKEDIN_ACCESS_TOKEN=""
ENV LINKEDIN_USER_ID=""

# Discord
ENV DISCORD_BOT_TOKEN=""
ENV DISCORD_DEFAULT_CHANNEL_ID=""

# Slack
ENV SLACK_BOT_TOKEN=""
ENV SLACK_DEFAULT_CHANNEL=general

# WhatsApp
ENV WHATSAPP_ACCESS_TOKEN=""
ENV WHATSAPP_PHONE_NUMBER_ID=""

# Facebook
ENV FACEBOOK_ACCESS_TOKEN=""
ENV FACEBOOK_PAGE_ID=""

# Instagram
ENV INSTAGRAM_ACCESS_TOKEN=""
ENV INSTAGRAM_ACCOUNT_ID=""

# Expose webhook port
EXPOSE 3456

# Run the agent (interactive REPL or single-shot via CMD override)
ENTRYPOINT ["node", "dist/index.js"]
