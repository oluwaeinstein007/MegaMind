export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  query: string;
  response_time: number;
}

class TavilyError extends Error {
  status?: number;
  requestId?: string;

  constructor(message: string, opts?: { status?: number; requestId?: string }) {
    super(message);
    this.name = 'TavilyError';
    this.status = opts?.status;
    this.requestId = opts?.requestId;
  }
}

export class TavilySearchTool {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || '';
    this.baseUrl = 'https://api.tavily.com/search';
  }

  async search(
    query: string,
    options: {
      search_depth?: 'basic' | 'advanced';
      topic?: 'general' | 'news' | 'finance';
      days?: number;
      max_results?: number;
      include_domains?: string[];
      exclude_domains?: string[];
      include_answer?: boolean;
      include_raw_content?: boolean | 'markdown' | 'text';
      include_images?: boolean;
      include_image_descriptions?: boolean;
      include_favicon?: boolean;
    } = {}
  ): Promise<TavilySearchResponse> {
    const {
      search_depth = 'basic',
      topic = 'general',
      days = 3,
      max_results = 10,
      include_domains = [],
      exclude_domains = [],
      include_answer = false,
      include_raw_content = false,
      include_images = false,
      include_image_descriptions = false,
      include_favicon = false
    } = options;

    if (!this.apiKey || this.apiKey === 'your_tavily_api_key_here' || this.apiKey.trim() === '') {
      console.warn('⚠️ Missing TAVILY_API_KEY. Falling back to mock search results for query:', query);
      return {
        results: [
          {
            title: `${query} - Expert Travel Guide & Local Recommendations`,
            url: `https://travel-insights-mock.com/search?q=${encodeURIComponent(query)}`,
            content: `Comprehensive guide for "${query}". Includes top attractions, seasonal timing advice, average daily travel costs, transportation logistics, hidden neighborhood gems, local food specialties, and highly-rated dining and accommodation selections fitting all budgets.`,
            score: 0.98
          },
          {
            title: `Top Things to Do & Local Customs - ${query}`,
            url: `https://local-customs-mock.com/${encodeURIComponent(query)}`,
            content: `Insider local tips and etiquette guidelines for travelers visiting "${query}". Covers cultural customs, dress codes, tipping etiquette, language basics, transit tips, and secret spots locals love.`,
            score: 0.95
          }
        ],
        query,
        response_time: 15
      };
    }

    try {
      const time_range = this.daysToTimeRange(days);
      const requestBody: Record<string, any> = {
        query,
        search_depth,
        topic,
        max_results,
        include_answer,
        include_raw_content,
        include_images,
        include_image_descriptions,
        include_favicon,
        ...(time_range ? { time_range } : {}),
        ...(include_domains.length > 0 ? { include_domains } : {}),
        ...(exclude_domains.length > 0 ? { exclude_domains } : {}),
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        const reqId = response.headers.get('x-request-id') || undefined;
        throw new TavilyError(
          `Tavily search failed (${response.status}). ${errorText}`.trim(),
          { status: response.status, requestId: reqId }
        );
      }

      const data = await response.json();
      
      const rt = typeof data.response_time === 'string'
        ? Number.parseFloat(data.response_time)
        : (typeof data.response_time === 'number' ? data.response_time : 0);

      return {
        results: (data.results || []).map((r: any) => ({
          title: r.title || '',
          url: r.url || '',
          content: r.content || '',
          score: r.score || 0,
          published_date: r.published_date
        })),
        query: data.query || query,
        response_time: Number.isFinite(rt) ? rt : 0
      };
      
    } catch (error) {
      // No mock fallbacks in production-grade mode.
      if (error instanceof TavilyError) throw error;
      throw new TavilyError(`Tavily search error: ${(error as Error)?.message || String(error)}`);
    }
  }

  private daysToTimeRange(days?: number): 'day' | 'week' | 'month' | 'year' | undefined {
    if (!days || days <= 0) return undefined;
    if (days <= 1) return 'day';
    if (days <= 7) return 'week';
    if (days <= 31) return 'month';
    return 'year';
  }

  async searchDestinations(destination: string, interests: string): Promise<TavilySearchResponse> {
    const query = `best ${destination} destinations ${interests} travel guide 2024`;
    return this.search(query, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 5,
      include_domains: ['tripadvisor.com', 'lonelyplanet.com', 'timeout.com']
    });
  }

  async searchLocalEvents(city: string, dateRange: string): Promise<TavilySearchResponse> {
    const query = `${city} events festivals activities ${dateRange}`;
    return this.search(query, {
      search_depth: 'basic',
      topic: 'news',
      days: 30,
      max_results: 8
    });
  }

  async searchBudgetInfo(city: string, budget: string): Promise<TavilySearchResponse> {
    const query = `${city} travel costs ${budget} budget accommodation food activities`;
    return this.search(query, {
      search_depth: 'advanced',
      max_results: 6
    });
  }

  /**
   * Search social media and creator content (TikTok, Instagram, YouTube, Reddit)
   * for authentic travel recommendations and hidden gems
   */
  async searchSocialMedia(destination: string, topic: string = ''): Promise<TavilySearchResponse> {
    const query = `${destination} ${topic} travel tips hidden gems locals recommend site:tiktok.com OR site:reddit.com/r/travel OR site:youtube.com OR site:instagram.com`;
    return this.search(query, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 10,
      days: 90, // Recent social content
    });
  }

  /**
   * Search TikTok specifically for travel content
   */
  async searchTikTok(destination: string, topic: string = ''): Promise<TavilySearchResponse> {
    const query = `${destination} ${topic} travel tips hidden gems what to do site:tiktok.com`;
    return this.search(query, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 8,
      days: 60,
    });
  }

  /**
   * Search Reddit for authentic local advice
   */
  async searchReddit(destination: string, topic: string = ''): Promise<TavilySearchResponse> {
    const subreddits = 'site:reddit.com/r/travel OR site:reddit.com/r/solotravel OR site:reddit.com/r/TravelHacks';
    const query = `${destination} ${topic} ${subreddits}`;
    return this.search(query, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 8,
      days: 180,
    });
  }

  /**
   * Search YouTube for travel vlogs and guides
   */
  async searchYouTube(destination: string, topic: string = ''): Promise<TavilySearchResponse> {
    const query = `${destination} ${topic} travel vlog guide site:youtube.com`;
    return this.search(query, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 6,
      days: 365,
    });
  }

  /**
   * Comprehensive travel search across all sources
   */
  async comprehensiveSearch(destination: string, interests: string): Promise<{
    traditional: TavilySearchResponse;
    social: TavilySearchResponse;
    reddit: TavilySearchResponse;
  }> {
    const [traditional, social, reddit] = await Promise.all([
      this.searchDestinations(destination, interests),
      this.searchSocialMedia(destination, interests),
      this.searchReddit(destination, interests),
    ]);
    return { traditional, social, reddit };
  }

  /**
   * Search for specific booking and reservation info
   */
  async searchBookingInfo(destination: string, type: 'hotel' | 'restaurant' | 'activity' | 'flight'): Promise<TavilySearchResponse> {
    const typeQueries: Record<string, string> = {
      hotel: `best hotels ${destination} booking reviews 2024 site:booking.com OR site:hotels.com OR site:tripadvisor.com`,
      restaurant: `best restaurants ${destination} reservations reviews site:yelp.com OR site:tripadvisor.com OR site:thefork.com OR site:opentable.com`,
      activity: `things to do ${destination} tours tickets site:getyourguide.com OR site:viator.com OR site:tripadvisor.com`,
      flight: `flights to ${destination} deals site:skyscanner.com OR site:kayak.com OR site:google.com/flights`,
    };
    return this.search(typeQueries[type] || typeQueries.activity, {
      search_depth: 'advanced',
      topic: 'general',
      max_results: 10,
    });
  }

  /**
   * Search for real-time information (weather, events, news)
   */
  async searchRealTimeInfo(destination: string): Promise<TavilySearchResponse> {
    const query = `${destination} weather today events happening this week news`;
    return this.search(query, {
      search_depth: 'basic',
      topic: 'news',
      days: 1,
      max_results: 5,
    });
  }
}