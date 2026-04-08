/**
 * NomadSage Travel Advisor — tool declarations for Gemini.
 *
 * Only knowledge-base tools are exposed here:
 *   • search_travel_content  — Qdrant semantic search with SQLite fallback
 *   • sample_travel_content  — random chunk sampling
 *
 * Social media tools (broadcast, linkedin, twitter, etc.) live in social-agent/.
 */

export interface FunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';

// ── Tool declarations (passed to Gemini) ──────────────────────────────────────

export const TRAVEL_TOOLS: FunctionDeclaration[] = [
  {
    name: 'search_travel_content',
    description:
      'Search the MegaMind travel knowledge base for relevant content. ' +
      'Always call this before answering a travel question — it grounds your response in ' +
      'real visa requirements, destination guides, budgets, immigration rules, and travel tips. ' +
      'Returns source URLs and titles which must be cited in your References section. ' +
      'Uses Qdrant semantic search when available, SQLite keyword search as fallback.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords or phrase to search (e.g. "Bali tourist visa", "UK visa from Nigeria", "cheapest flights Europe").',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 8, max 20).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'sample_travel_content',
    description:
      'Return a random sample of travel chunks from the MegaMind database. ' +
      'Use when the user asks for travel inspiration, destination ideas, or general browsing ' +
      'without a specific topic in mind.',
    parameters: {
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

// ── Names set for routing ─────────────────────────────────────────────────────

export const TRAVEL_TOOL_NAMES = new Set(TRAVEL_TOOLS.map((t) => t.name));

// ── Executor ──────────────────────────────────────────────────────────────────

/**
 * Execute a travel knowledge-base tool and return a JSON string result.
 * Results include source URLs so Gemini can include them in References.
 */
export async function executeTravelTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {

    // ── search_travel_content ──────────────────────────────────────────────
    case 'search_travel_content': {
      const query = String(input.query ?? '').trim();
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 8;
      if (!query) return JSON.stringify({ error: 'query is required' });

      const results = await searchTravelContent(query, limit);

      if (results.length === 0) {
        const count = getTravelContentCount();
        return JSON.stringify({
          results: [],
          note: count === 0
            ? 'Knowledge base is empty — run the MegaMind ingestor first.'
            : `No matches for "${query}". Try broader keywords or rephrase the query.`,
        });
      }

      type WithScore = (typeof results)[number] & { score?: number };
      const hasScore = (r: unknown): r is WithScore => typeof (r as WithScore).score === 'number';
      const firstScore = hasScore(results[0]) ? results[0].score : undefined;

      return JSON.stringify({
        total: results.length,
        search_type: firstScore !== undefined ? 'semantic (Qdrant)' : 'keyword (SQLite)',
        instruction: 'Cite every source in a References section at the end of your response.',
        results: results.map((r) => ({
          id:       r.id,
          title:    (r.metadata as Record<string, unknown>)?.title ?? r.source,
          source:   r.source,
          type:     r.type,
          content:  r.content.length > 1200 ? r.content.slice(0, 1200) + '…' : r.content,
          metadata: r.metadata,
          score:    hasScore(r) ? r.score : undefined,
        })),
      });
    }

    // ── sample_travel_content ──────────────────────────────────────────────
    case 'sample_travel_content': {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 4;
      const results = sampleTravelContent(limit);

      if (results.length === 0) {
        return JSON.stringify({ results: [], note: 'Knowledge base is empty — run the ingestor first.' });
      }

      return JSON.stringify({
        instruction: 'Cite every source in a References section at the end of your response.',
        results: results.map((r) => ({
          id:      r.id,
          title:   (r.metadata as Record<string, unknown>)?.title ?? r.source,
          source:  r.source,
          content: r.content.length > 1200 ? r.content.slice(0, 1200) + '…' : r.content,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown travel tool: ${name}` });
  }
}
