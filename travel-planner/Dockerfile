# Multi-stage Dockerfile for deploying Next.js Travel Planner application using Bun
FROM oven/bun:1.1-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy lockfile and package JSON
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Set environment variables for production build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy essential files for execution
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["bun", "run", "start"]
