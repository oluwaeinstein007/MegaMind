import { z } from 'zod';
import { tool } from '@veridex/agents';
import { searchTravelContent, sampleTravelContent, getTravelContentCount } from '../lib/megamind.js';

export const searchTravelContentTool = tool({
  name: 'search_travel_content',
  guidance: {
    summary: 'Search the MegaMind travel knowledge base for relevant content.',
    whenToUse: [
      'The user asks a factual question about visas, entry requirements, destinations, budgets, or travel advice.',
      'Always call this tool before answering any travel-related question to ground your response in real, structured data.',
    ],
    whenNotToUse: [
      'To list every raw document or paginated chunk in the database — use `list_documents` instead.',
      'To get broad random travel inspiration without a specific query — use `sample_travel_content` instead.',
    ],
    successExample: 'Successful result: { "total": 2, "search_type": "semantic (Qdrant)", "results": [...] }',
  },
  input: z.object({
    query: z.string().min(1).describe('Keywords or phrase to search (e.g. "Bali tourist visa", "UK visa from Nigeria", "cheapest flights Europe").'),
    limit: z.number().optional().describe('Max results to return (default 8, max 20).'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    const query = String(input.query ?? '').trim();
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 20) : 8;
    if (!query) {
      return { success: false, llmOutput: 'query is required', error: 'Missing query' };
    }

    const results = await searchTravelContent(query, limit);

    if (results.length === 0) {
      const count = getTravelContentCount();
      return {
        success: true,
        llmOutput: JSON.stringify({
          results: [],
          note: count === 0
            ? 'Knowledge base is empty — run the MegaMind ingestor first.'
            : `No matches for "${query}". Try broader keywords or rephrase the query.`,
        }),
      };
    }

    return {
      success: true,
      llmOutput: JSON.stringify({
        total: results.length,
        search_type: results[0] && 'score' in results[0] ? 'semantic (Qdrant)' : 'keyword (SQLite)',
        instruction: 'Cite every source in a References section at the end of your response.',
        results: results.map((r: any) => ({
          id:       r.id,
          title:    (r.metadata as Record<string, unknown>)?.title ?? r.source,
          source:   r.source,
          type:     r.type,
          content:  r.content.length > 1200 ? r.content.slice(0, 1200) + '…' : r.content,
          metadata: r.metadata,
          score:    r.score,
        })),
      }),
    };
  },
});

export const sampleTravelContentTool = tool({
  name: 'sample_travel_content',
  guidance: {
    summary: 'Return a random sample of travel chunks from the MegaMind database for browsing.',
    whenToUse: [
      'The user asks for general travel inspiration, destination ideas, or general browsing without a specific topic in mind.',
    ],
    whenNotToUse: [
      'When the user asks a specific question about visas, entry rules, or budgets — use `search_travel_content` instead.',
    ],
    successExample: 'Successful result: { "results": [...] }',
  },
  input: z.object({
    limit: z.number().optional().describe('Number of random chunks to return (default 4, max 10).'),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    const limit = typeof input.limit === 'number' ? Math.min(input.limit, 10) : 4;
    const results = sampleTravelContent(limit);

    if (results.length === 0) {
      return {
        success: true,
        llmOutput: JSON.stringify({ results: [], note: 'Knowledge base is empty — run the ingestor first.' }),
      };
    }

    return {
      success: true,
      llmOutput: JSON.stringify({
        instruction: 'Cite every source in a References section at the end of your response.',
        results: results.map((r: any) => ({
          id:      r.id,
          title:   (r.metadata as Record<string, unknown>)?.title ?? r.source,
          source:  r.source,
          content: r.content.length > 1200 ? r.content.slice(0, 1200) + '…' : r.content,
        })),
      }),
    };
  },
});
