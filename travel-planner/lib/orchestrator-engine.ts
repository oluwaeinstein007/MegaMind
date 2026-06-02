import { Orchestrator, tool } from '@veridex/agents';
import { z } from 'zod';
import {
  citySelectorAgent,
  localExpertAgent,
  travelConciergeAgent,
  bookingCuratorAgent,
  geminiProvider,
} from './agents/veridex-agents';
import { TavilySearchTool } from './tools/tavily-search';
import { CalculateTool } from './tools/calculate';

const tavilySearch = new TavilySearchTool();
const calculateTool = new CalculateTool();

const runSearchCounts = new Map<string, number>();

// ── Define Veridex Dynamic Tools ──────────────────────────────────────────────
export const tavilySearchVeridexTool = tool({
  name: 'tavily_search',
  description: 'Search the web for real-time travel information, local events, sights, and dining.',
  input: z.object({
    query: z.string().describe('Search keywords'),
  }),
  safetyClass: 'network',
  async execute({ input, context }) {
    const runId = context?.runId || 'default-run';
    const agentId = context?.agentId || 'unknown-agent';

    // Enforce hard search budget limits at the tool level
    let maxSearches = 1;
    if (agentId === 'city-selector-agent') {
      maxSearches = 3;
    }

    const currentCount = runSearchCounts.get(runId) ?? 0;
    console.log(`[tavily_search] Agent "${agentId}" (Run: ${runId}) invocation ${currentCount + 1}/${maxSearches} for query: "${input.query}"`);

    if (currentCount >= maxSearches) {
      console.warn(`[tavily_search] Budget exceeded for agent "${agentId}". Returning error output to guide model termination.`);
      return {
        success: false,
        llmOutput: `Error: Tavily search budget exceeded. You are allowed AT MOST ${maxSearches} search(es) in this task, and you have already used them. You MUST synthesize and output your final response now using only the information you already gathered. Do NOT attempt any more searches or tool calls.`,
        error: 'Search budget exceeded'
      };
    }

    runSearchCounts.set(runId, currentCount + 1);

    try {
      const res = await tavilySearch.search(input.query, { max_results: 5 });
      console.log(`[tavily_search] Success. Found ${res.results?.length || 0} results.`);
      return { success: true, llmOutput: JSON.stringify(res) };
    } catch (err) {
      console.error(`[tavily_search] Failed for query "${input.query}":`, err);
      return { success: false, llmOutput: `Search failed: ${(err as Error).message}`, error: (err as Error).message };
    }
  },
});

export const calculateVeridexTool = tool({
  name: 'calculate',
  description: 'Execute math calculations or date/duration calculations.',
  input: z.object({
    expression: z.string().describe('Expression or dates to calculate'),
    type: z.enum(['numeric', 'date', 'duration', 'currency']).optional(),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    try {
      const res = calculateTool.calculate(input.expression, input.type || 'numeric');
      return { success: true, llmOutput: JSON.stringify(res) };
    } catch (err) {
      return { success: false, llmOutput: `Calculation failed: ${(err as Error).message}`, error: (err as Error).message };
    }
  },
});

// Configure tools on agent definitions dynamically
citySelectorAgent.definition.tools = [tavilySearchVeridexTool as any];
localExpertAgent.definition.tools = [tavilySearchVeridexTool as any];
travelConciergeAgent.definition.tools = [calculateVeridexTool as any];
bookingCuratorAgent.definition.tools = [tavilySearchVeridexTool as any];

export interface OrchestrationInput {
  destination: string;
  budget: 'budget' | 'moderate' | 'luxury';
  startDate: string;
  endDate: string;
  travelers: string;
  interests: string;
  comingFrom?: string;
}

export class OrchestratorEngine {
  async execute(preferences: OrchestrationInput): Promise<any> {
    console.log('🚀 Starting Veridex TaskGraph Orchestrator for TravelMind');
    runSearchCounts.clear();

    // Instantiate native Orchestrator
    const orchestrator = new Orchestrator({
      team: {
        id: 'travel-planning-team',
        name: 'MegaMind Travel Specialist Team',
        members: [
          { definition: citySelectorAgent.definition, capabilities: ['city-selection'] },
          { definition: localExpertAgent.definition, capabilities: ['local-expert'] },
          { definition: travelConciergeAgent.definition, capabilities: ['itinerary-creation'] },
          { definition: bookingCuratorAgent.definition, capabilities: ['booking-curation'] },
        ],
        maxConcurrency: 2,
      },
      defaultRuntimeOptions: {
        enableTracing: true,
        enableCheckpoints: false,
        modelProviders: {
          gemini: geminiProvider,
        },
      },
    });

    // Add tasks to the Orchestrator
    const t1 = orchestrator.addTask({
      title: 'City Selection',
      description: `Evaluate traveler preferences and select the best city for: Destination=${preferences.destination}, Budget=${preferences.budget}, Interests=${preferences.interests}, Travelers=${preferences.travelers}, Origin=${preferences.comingFrom || 'Not specified'}, Dates=${preferences.startDate} to ${preferences.endDate}. Ranks 3 top recommendations.`,
      metadata: {
        requiredCapabilities: ['city-selection'],
      },
    });

    const t2 = orchestrator.addTask({
      title: 'Local Exploration & Hidden Gems',
      description: 'Get deep insider local knowledge, hidden gems, and cultural customs for the selected recommended city.',
      dependsOn: [t1.id],
      metadata: {
        requiredCapabilities: ['local-expert'],
      },
    });

    const t3 = orchestrator.addTask({
      title: 'Itinerary Design',
      description: `Build a highly detailed, geographically-optimized, day-by-day travel itinerary using the selected city and local expert insights. Start Date=${preferences.startDate}, End Date=${preferences.endDate}.`,
      dependsOn: [t1.id, t2.id],
      metadata: {
        requiredCapabilities: ['itinerary-creation'],
      },
    });

    const t4 = orchestrator.addTask({
      title: 'Booking Curation',
      description: 'Curate hotel options, restaurant recommendations, and activity booking details fitting constraints.',
      dependsOn: [t3.id],
      metadata: {
        requiredCapabilities: ['booking-curation'],
      },
    });

    const startTime = Date.now();
    const runResult = await orchestrator.run();
    const durationMs = Date.now() - startTime;

    console.log('✅ Veridex Orchestration Finished in', durationMs, 'ms');
    console.log('--- Raw runResult ---');
    console.log(JSON.stringify({
      success: runResult.success,
      sharedMemory: Object.fromEntries(runResult.sharedMemory.entries()),
      agentResults: Array.from(runResult.agentResults.entries()).map(([k, v]) => [k, {
        output: v.output,
        run: { state: v.run?.state, error: v.run?.error }
      }])
    }, null, 2));
    console.log('---------------------');

    console.log('Tasks status breakdown:');
    runResult.taskGraph.tasks.forEach((t) => {
      console.log(`- Task: "${t.title}" | Status: ${t.status} | Assignee: ${t.assigneeId}${t.error ? ` | Error: ${t.error}` : ''}`);
    });

    // Extract raw outputs from task shared memory
    const citySelectionRaw = runResult.sharedMemory.get(`task:${t1.id}:result`) || '';
    const localExplorationRaw = runResult.sharedMemory.get(`task:${t2.id}:result`) || '';
    const itineraryCreationRaw = runResult.sharedMemory.get(`task:${t3.id}:result`) || '';
    const bookingCurationRaw = runResult.sharedMemory.get(`task:${t4.id}:result`) || '';

    // Try to parse JSON if the agents returned structured output; otherwise,
    // extract structured data from the rich markdown using heuristics.
    const cityData = this.parseAgentOutput(citySelectionRaw);
    const localData = this.parseAgentOutput(localExplorationRaw);
    let itineraryData = this.parseAgentOutput(itineraryCreationRaw);
    const bookingData = this.parseAgentOutput(bookingCurationRaw);

    // Extract destination from the city agent output
    const destination = cityData.selectedCity
      || this.extractPattern(citySelectionRaw, /selected?\s*city[:\s]*([^\n]+)/i)
      || this.extractPattern(citySelectionRaw, /^#.*?:\s*(.+?)(?:\s*luxury|\s*experience|\s*–|\n)/im)
      || preferences.destination;

    // Calculate expected days and ensure itinerary schedule has the correct length
    const start = new Date(preferences.startDate);
    const end = new Date(preferences.endDate);
    let expectedDays = 7;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.abs(end.valueOf() - start.valueOf());
      expectedDays = Math.max(1, Math.ceil(diff / 86_400_000)) + 1; // +1 to include both start and end day
    }

    // Ensure itineraryData is not raw text if we want to pad a schedule
    if (itineraryData._raw) {
      console.warn('⚠️ itineraryData returned raw text. Trying to initialize structured schedule for padding.');
      itineraryData = {
        schedule: [],
        totalBudget: { amount: '$0', currency: 'USD', breakdown: { accommodation: '$0', food: '$0', activities: '$0', transportation: '$0' } },
        logistics: { transportation: '', packingTips: [], localTips: [] }
      };
    }

    if (itineraryData) {
      itineraryData.schedule = this.ensureCorrectDays(
        itineraryData.schedule || [],
        expectedDays,
        destination,
        preferences.startDate
      );
    }

    // Safely extract clean markdown guides (avoid displaying raw JSON structures)
    const cityMarkdown = cityData.richMarkdownReport || cityData.content || citySelectionRaw;
    const localMarkdown = localData.richMarkdownReport || localData.content || localExplorationRaw;
    const itineraryMarkdown = itineraryData.richMarkdownReport || itineraryData.content || itineraryCreationRaw;
    const bookingMarkdown = bookingData.richMarkdownReport || bookingData.content || bookingCurationRaw;

    // Build the rich response, carrying raw markdown content for the UI to render
    return {
      success: runResult.success,
      orchestration: {
        steps: runResult.taskGraph.tasks.length,
        agents_executed: runResult.taskGraph.tasks.map((t) => t.assigneeId),
        tool_calls: Array.from(runResult.agentResults.values()).reduce((acc, r) => acc + r.events.filter(e => e.type === 'tool_executed').length, 0),
        execution_time: durationMs,
      },
      recommendations: cityData.alternatives || [],
      itinerary: {
        destination,
        localInsights: localData.insights || [],
        schedule: itineraryData.schedule || [],
        budget: itineraryData.totalBudget || { amount: '$0', currency: 'USD', breakdown: { accommodation: '$0', food: '$0', activities: '$0', transportation: '$0' } },
        logistics: itineraryData.logistics || { transportation: '', packingTips: [], localTips: [] },
      },
      // Rich content: raw markdown from each agent for the UI to render directly
      rich_content: {
        city_selection: cityMarkdown,
        local_exploration: localMarkdown,
        itinerary_design: itineraryMarkdown,
        booking_curation: bookingMarkdown,
      },
      workflow_data: {
        city_analysis: cityData,
        local_insights: localData,
        travel_logistics: itineraryData,
        booking_curation: bookingData,
        rich_content: {
          city_selection: cityMarkdown,
          local_exploration: localMarkdown,
          itinerary_design: itineraryMarkdown,
          booking_curation: bookingMarkdown,
        },
        tool_results: Array.from(runResult.agentResults.values()).flatMap(r => r.events.filter(e => e.type === 'tool_executed')),
      },
    };
  }

  /**
   * Parse agent output — tries JSON first (both bare and markdown-fenced),
   * falls back to returning an object with the raw markdown text.
   */
  private parseAgentOutput(text: string): any {
    if (!text || text.trim().length === 0) return {};

    // 1. Try extracting a JSON block from markdown fenced code
    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fencedMatch) {
      const codeBlock = fencedMatch[1].trim();
      try {
        return JSON.parse(codeBlock);
      } catch {
        const recovered = this.attemptJsonRecovery(codeBlock);
        if (recovered) return recovered;
      }
    }

    // 2. Try parsing the entire text as JSON
    try {
      return JSON.parse(text.trim());
    } catch {
      const recovered = this.attemptJsonRecovery(text);
      if (recovered) return recovered;
    }

    // 3. Try extracting any top-level JSON object from the text
    try {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = text.substring(firstBrace, lastBrace + 1);
        return JSON.parse(candidate);
      }
    } catch { /* fall through */ }

    // 4. If no JSON found, return the raw text wrapped in a structured envelope
    return { _raw: true, content: text };
  }

  /**
   * Attempt to recover from truncated or malformed JSON responses
   */
  private attemptJsonRecovery(text: string): any | null {
    try {
      let fixed = text.trim();

      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;

      if (fixed.includes('"') && !fixed.endsWith('"') && !fixed.endsWith('}') && !fixed.endsWith(']')) {
        const lastCompleteObject = fixed.lastIndexOf('},');
        const lastCompleteArray = fixed.lastIndexOf('],');
        const lastComplete = Math.max(lastCompleteObject, lastCompleteArray);

        if (lastComplete > fixed.length * 0.7) {
          fixed = fixed.substring(0, lastComplete + 1);
        }
      }

      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += ']';
      }
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixed += '}';
      }

      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }

  private addDays(date: string, offset: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }

  /**
   * Ensures the schedule has exactly the correct number of days.
   * If AI returns fewer days, pad with generic activities.
   * If AI returns more days, truncate.
   */
  private ensureCorrectDays(
    schedule: any[],
    expectedDays: number,
    city: string,
    startDate: string
  ): any[] {
    const currentDays = schedule.length;

    if (currentDays === expectedDays) {
      console.log(`✓ Schedule has correct number of days: ${expectedDays}`);
      return schedule;
    }

    if (currentDays > expectedDays) {
      console.log(`⚠️ Truncating schedule from ${currentDays} to ${expectedDays} days`);
      return schedule.slice(0, expectedDays);
    }

    // Need to add more days
    console.log(`⚠️ Padding schedule from ${currentDays} to ${expectedDays} days`);
    const themes = [
      { title: `Exploring More of ${city}`, theme: 'Extended Discovery' },
      { title: `${city} Hidden Gems`, theme: 'Local Secrets' },
      { title: `Relaxed Day in ${city}`, theme: 'Leisure & Relaxation' },
      { title: `${city} Adventure Day`, theme: 'Adventure' },
      { title: `Cultural Deep Dive`, theme: 'Culture & Heritage' },
      { title: `${city} Food Tour`, theme: 'Culinary Journey' },
      { title: `Shopping & Souvenirs`, theme: 'Shopping' },
      { title: `Nature Escape`, theme: 'Nature & Outdoors' },
    ];

    for (let i = currentDays; i < expectedDays; i++) {
      const themeIdx = i % themes.length;
      const dayDate = this.addDays(startDate, i);

      schedule.push({
        day: i + 1,
        date: dayDate,
        title: themes[themeIdx].title,
        theme: themes[themeIdx].theme,
        activities: this.buildGenericActivities(city, themes[themeIdx].theme),
        dailyBudget: '$150',
        neighborhoods: [],
        highlights: [`Day ${i + 1} highlights`],
        notes: [`Extended itinerary day ${i + 1}`]
      });
    }

    return schedule;
  }

  private buildGenericActivities(city: string, theme: string): any[] {
    return [
      {
        time: '09:00',
        activity: `${theme} Morning Walk`,
        type: 'sightseeing',
        specificPlace: `${city} Center`,
        address: city,
        description: `A relaxed ${theme.toLowerCase()} walk to start the day`,
        duration: '2h',
        cost: 'Free',
        tips: ['Bring water', 'Wear comfy shoes']
      },
      {
        time: '12:30',
        activity: 'Local Lunch',
        type: 'dining',
        specificPlace: `Typical ${city} Eatery`,
        address: city,
        description: 'Try a signature local dish',
        duration: '1.5h',
        cost: '$20‑30',
        tips: ['Ask for today’s special']
      },
      {
        time: '15:00',
        activity: `${theme} Afternoon`,
        type: 'leisure',
        specificPlace: `${city} Highlight`,
        address: city,
        description: 'Continue exploring with a focus on local vibes',
        duration: '3h',
        cost: '$10‑40'
      },
      {
        time: '19:00',
        activity: 'Evening at leisure',
        type: 'leisure',
        specificPlace: 'User’s choice',
        address: city,
        description: 'Flexible time – dinner, show, or night walk',
        duration: 'open',
        cost: 'Varies'
      }
    ];
  }

  /** Extract a capture group from text using a regex pattern. */
  private extractPattern(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    return match?.[1]?.trim();
  }
}
