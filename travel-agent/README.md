# NomadSage — Travel Advisor Agent

A Gemini-powered travel advisor. Answers questions grounded in MegaMind's knowledge base with source citations,
replies on Twitter/Telegram/Discord/Slack/WhatsApp via [social-mcp](https://www.npmjs.com/package/social-mcp),
and can search & book real flights/hotels and track visa/immigration applications on the TVA OTA platform via
the sibling [TravelAgentMCP](https://github.com/nxGnosis/travelagent-mcp) repo's MCP server suite.

## Capabilities

- **Knowledge-base Q&A** (`src/tools/travel.ts`, `src/lib/megamind.ts`) — semantic search (Qdrant) with SQLite
  keyword fallback over MegaMind's ingested travel content, always cited.
- **Social platform replies** (`src/lib/mcp-client.ts`) — outbound messages on all platforms go through
  social-mcp; no custom platform clients live here.
- **Flight/hotel/visa/immigration/account booking** (`src/lib/tva-client.ts`, `src/lib/tva-session.ts`) — spawns
  each domain server from `../../TravelAgentMCP/mcps/*` over stdio per conversation. Optional: the agent runs
  fine without it (knowledge-base + social only) if that repo isn't checked out, or if `TVA_MCP_ENABLED=false`.
- **Conversation memory** (`src/lib/memory.ts`) — Gemini chat history persisted in SQLite per session.
- **Telegram bot, webhook server, Twitter monitor, scheduler** — see `src/index.ts` for what's enabled by which
  env vars.

## Booking guardrails

TVA_ACCESS_TOKEN is never a tool argument the model can see or set — `tva-session.ts` persists it per
conversation session (SQLite) and `tva-client.ts` injects it into each spawned MCP child's environment.
`LOGIN_USER`/`SOCIAL_AUTH_LOGIN` results are intercepted before they reach the model so the raw token never
enters the conversation; login attempts are rate-limited per session. See `SYSTEM_INSTRUCTION` in `src/agent.ts`
for the confirmation rules the model follows before booking, cancelling, or paying for anything, and see
TravelAgentMCP's README for the full guardrail list (rate limiting, redaction, offer caching, least privilege).

## Setup

```bash
pnpm install
cp .env.example .env   # fill in GEMINI_API_KEY at minimum
pnpm build
pnpm start
```

`pnpm dev` runs the REPL directly with tsx (no build step). See `.env.example` for every optional integration
(Telegram, Twitter, Discord, Slack, WhatsApp, webhook server, scheduler, TVA booking tools).
