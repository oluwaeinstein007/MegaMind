import { TavilySearchTool } from '../tools/tavily-search';
import type { TavilySearchResult } from '../tools/tavily-search';

export interface CuratedPlace {
  name: string;
  url: string;
  blurb: string;
  type: 'hotel' | 'restaurant' | 'activity';
  estimatedPrice?: string;
  ratingScore?: number;
  address?: string;
}

export interface BookingCuratorOutput {
  curated: CuratedPlace[];
  confidence: number;
}

export class BookingCurator {
  private tavily = new TavilySearchTool();

  async curate(city: string, budget: string, interests: string): Promise<BookingCuratorOutput> {
    const queries: { q: string; type: 'hotel' | 'restaurant' | 'activity' }[] = [
      { q: `${city} best hotels ${budget} 2025`, type: 'hotel'  },
      { q: `${city} must-try restaurants ${budget} foodie`, type: 'restaurant' },
      { q: `${city} top activities ${interests} 2025`,       type: 'activity'  }
    ];

    const curated: CuratedPlace[] = [];
    for (const { q, type } of queries) {
      const res = await this.tavily.search(q, { max_results: 3 });
      res.results.forEach((r: TavilySearchResult) => {
        curated.push({
          name: r.title.replace(/ –.*| \|.*| -.*$/,'').trim(),
          url:  r.url,
          blurb: r.content.slice(0, 160) + '…',
          type,
          ratingScore: Math.round(r.score * 100) / 20,   // crude 0‑5 scale
        });
      });
    }

    return { curated, confidence: 0.83 };
  }
}
