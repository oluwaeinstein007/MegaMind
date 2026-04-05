/**
 * Travel content tools — Anthropic tool definitions backed by MegaMind's SQLite.
 *
 * These are the only tools NOT delegated to social-mcp; they reach into the
 * MegaMind ingestor database to pull real travel knowledge so Claude can
 * compose grounded, accurate social posts.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';

// ── Tool definitions (passed to Claude) ──────────────────────────────────────

export const TRAVEL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_travel_content',
    description:
      "Search MegaMind's ingested travel knowledge base for relevant chunks. " +
      'Always call this before composing a travel post — it grounds the content in ' +
      'real visa requirements, destination guides, budgets, tips, and immigration info.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Keywords to search for (e.g. "Bali budget travel", "UK visa Nigeria", "Japan hidden gems").',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 6, max 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sample_travel_content',
    description:
      "Return a random sample of travel content from MegaMind's database. " +
      'Use when you need inspiration for a travel post without a specific topic.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of random chunks to return (default 4, max 10).',
        },
      },
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────────

export function executeTravelTool(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case 'search_travel_content': {
      const query = String(input.query ?? '');
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 6;

      if (!query.trim()) {
        return JSON.stringify({ error: 'query is required' });
      }

      const results = searchTravelContent(query, limit);

      if (results.length === 0) {
        const count = getTravelContentCount();
        return JSON.stringify({
          results: [],
          note:
            count === 0
              ? 'MegaMind database is empty — run the ingestor first (pnpm start in the MegaMind project).'
              : `No matches found for "${query}". Try broader keywords.`,
        });
      }

      return JSON.stringify({
        total_found: results.length,
        results: results.map((r) => ({
          id: r.id,
          source: r.source,
          type: r.type,
          // Trim very long chunks to avoid bloating the context window
          content: r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
          metadata: r.metadata,
        })),
      });
    }

    case 'sample_travel_content': {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 4;
      const results = sampleTravelContent(limit);

      if (results.length === 0) {
        return JSON.stringify({
          results: [],
          note: 'MegaMind database is empty — run the ingestor first.',
        });
      }

      return JSON.stringify({
        results: results.map((r) => ({
          id: r.id,
          source: r.source,
          content: r.content.length > 900 ? r.content.slice(0, 900) + '…' : r.content,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown travel tool: ${name}` });
  }
}

/** Set of travel tool names for fast lookup during routing */
export const TRAVEL_TOOL_NAMES = new Set(TRAVEL_TOOLS.map((t) => t.name));
