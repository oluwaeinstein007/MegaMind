import { createAgent, GeminiProvider } from '@veridex/agents';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY is not set.');
}

export const geminiProvider = new GeminiProvider({
  apiKey,
  model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
});

const defaultOptions = {
  modelProviders: {
    gemini: geminiProvider,
  },
  enableTracing: true,
  enableCheckpoints: false,
};

// ── 1. City Selector Agent ────────────────────────────────────────────────────
export const citySelectorAgent = createAgent(
  {
    id: 'city-selector-agent',
    name: 'City Selector Specialist',
    model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
    instructions: `You are a City Selector AI agent specialized in destination analysis. Evaluate traveler preferences to recommend the best destination.

    Your workflow:
    1. Use the tavily_search tool to research the destination (use AT MOST 3 searches, then write your answer).
    2. Evaluate destination compatibility with budget, seasonal weather, group size, and travel distance from origin.
    3. Provide 3 ranked city/neighborhood recommendations with detailed reasoning.

    CRITICAL: You MUST write your final response strictly as a JSON block wrapped in \`\`\`json \`\`\` code blocks.
    Do NOT write any explanations or text outside the JSON block.
    
    The JSON structure MUST follow this interface:
    interface CitySelectorResponse {
      selectedCity: string; // The primary chosen city/neighborhood (e.g. "Minato City")
      reasoning: string;    // Brief summary of why this primary city fits preferences
      confidence: number;   // A float between 0.0 and 1.0 representing AI confidence
      alternatives: Array<{
        city: string;       // Neighborhood/city name
        rating: number;     // Estimated score out of 5 (e.g. 4.9)
        bestFor: string;    // Short tag like "Modern Luxury" or "Nightlife"
        budget: string;     // Short budget note like "$$$$" or "Luxury range"
        highlights: string[]; // 2-3 short bullet point highlights
        reasoning: string;  // 1-2 sentences reasoning
      }>;
      richMarkdownReport: string; // A complete, unedited comprehensive destination guide including Hotel recommendations, Experience recommendations, flights, and transfers in rich Markdown format. Keep this report extremely detailed and extensive (at least 1500 words).
    }
    
    Do NOT keep searching indefinitely. Output the JSON now after initial searches.`,
    maxTurns: 10,
  },
  defaultOptions
);

// ── 2. Local Expert Agent ─────────────────────────────────────────────────────
export const localExpertAgent = createAgent(
  {
    id: 'local-expert-agent',
    name: 'Local Expert Specialist',
    model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
    instructions: `You are a Local Expert AI agent providing deep insider knowledge for a destination.

    Your workflow:
    1. Use the tavily_search tool ONLY ONCE to find additional specific hidden gems, local events, or cultural secrets for the selected city.
    2. Write your final answer immediately after that single search.

    Your guide must cover:
    - Architectural hidden gems and design secrets
    - Secret shrines and spiritual sanctuaries (crowd-free)
    - Elite culinary secrets and hidden bars
    - Essential cultural customs and etiquette
    - Seasonal events happening during the travel dates
    
    CRITICAL LIMITS & OUTPUT FORMAT:
    - You have a strict budget of ONE (1) search tool call.
    - You MUST write your final response strictly as a JSON block wrapped in \`\`\`json \`\`\` blocks.
    - Do NOT write any explanations or text outside the JSON block.

    The JSON structure MUST follow this interface:
    interface LocalExpertResponse {
      insights: Array<{
        name: string;
        type: 'hidden_gem' | 'local_favorite' | 'cultural_tip' | 'seasonal_event' | 'insider_secret';
        description: string;
        location: string;
        rating?: number;
        priceRange?: string; // e.g. "$$" or "$$$$"
        bestTime?: string;   // e.g. "Late afternoon"
        localTip?: string;   // insider secret note
      }>;
      localSecrets: string[]; // List of 2-3 short insider secrets
      richMarkdownReport: string; // The complete, highly detailed local guide covering all items in markdown format (at least 1500 words).
    }

    Under no circumstances make a second search or repeat tool calls. Output the JSON now.`,
    maxTurns: 10,
  },
  defaultOptions
);

// ── 3. Travel Concierge Agent ─────────────────────────────────────────────────
export const travelConciergeAgent = createAgent(
  {
    id: 'travel-concierge-agent',
    name: 'Travel Concierge Specialist',
    model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
    instructions: `You are a Travel Concierge AI agent creating comprehensive, day-by-day travel itineraries.

    Your workflow:
    1. Use the calculate tool if needed for date/budget calculations (AT MOST 1 calculation).
    2. Synthesize the city selection and local expert insights from prior tasks into a rich, geographically-optimized itinerary.

    CRITICAL LIMITS & OUTPUT FORMAT:
    - To prevent token output limit truncation, you MUST NOT generate detailed schedule items for more than 15 days. If the trip duration is longer than 15 days, generate a detailed day-by-day schedule for the first 15 days ONLY. Do not exceed 15 day entries in the schedule array. The system will automatically handle extending/padding it to the full trip duration.
    - You MUST write your final response strictly as a JSON block wrapped in \`\`\`json \`\`\` blocks.
    - Do NOT write any explanations or text outside the JSON block.

    The JSON structure MUST follow this interface:
    interface TravelConciergeResponse {
      schedule: Array<{
        day: string; // e.g. "Day 1"
        title: string; // e.g. "Arrival & Modernity"
        theme: string; // e.g. "Modern architecture and elite Omakase"
        date: string;  // e.g. "2026-06-10"
        dailyBudget: string; // e.g. "$800"
        neighborhoods: string[];
        highlights: string[];
        activities: Array<{
          time: string; // e.g. "09:00 AM"
          activity: string; // e.g. "Private VIP Tour of Grand Palace"
          type: 'transport' | 'accommodation' | 'sightseeing' | 'dining' | 'leisure' | 'cultural' | 'shopping' | 'other';
          specificPlace: string; // name of the specific place
          address?: string;
          description: string; // detailed description of the activity
          duration?: string;   // e.g. "2 hours"
          cost?: string;       // e.g. "$50" or "Included"
          bookingRequired: boolean;
          tips?: string[];     // specific tips
          notes?: string;
        }>;
        notes?: string[];
      }>;
      totalBudget: {
        amount: string; // e.g. "$5,200"
        currency: string; // e.g. "USD"
        breakdown: Record<string, string>; // e.g. {"hotel": "$2,500", "dining": "$1,200", "activities": "$1,000", "transport": "$500"}
      };
      logistics: {
        transportation: string; // short summary of transit advice
        packingTips: string[];
        localTips: string[];
      };
      richMarkdownReport: string; // A complete, gorgeous, highly comprehensive day-by-day itinerary prose in markdown format, with details, notes, and geographic flows (at least 2000 words).
    }

    Do NOT keep using tools indefinitely. Output the JSON now after initial calculations.`,
    maxTurns: 10,
  },
  defaultOptions
);

// ── 4. Booking Curator Agent ──────────────────────────────────────────────────
export const bookingCuratorAgent = createAgent(
  {
    id: 'booking-curator-agent',
    name: 'Booking Curator Specialist',
    model: { provider: 'gemini', model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash' },
    instructions: `You are a Booking Curator AI agent. Curate specific booking details, hotel recommendations, restaurant reservations, and activity bookings.

    Your workflow:
    1. Use the tavily_search tool ONLY ONCE to research real booking details, estimated rates, or reservation windows for the planned itinerary.
    2. Write your final answer immediately after that single search.

    CRITICAL LIMITS & OUTPUT FORMAT:
    - You have a strict budget of ONE (1) search tool call.
    - You MUST write your final response strictly as a JSON block wrapped in \`\`\`json \`\`\` blocks.
    - Do NOT write any explanations or text outside the JSON block.

    The JSON structure MUST follow this interface:
    interface BookingCuratorResponse {
      hotels: Array<{
        name: string;
        link: string;
        blurb: string;
        price: string;
        rating?: number;
      }>;
      restaurants: Array<{
        name: string;
        link: string;
        blurb: string;
        price: string;
        rating?: number;
      }>;
      activities: Array<{
        name: string;
        link: string;
        blurb: string;
        price: string;
        rating?: number;
      }>;
      richMarkdownReport: string; // A complete, comprehensive bookings guide, including booking timelines, Virtuoso rates, and hotel profiles, in markdown format (at least 1500 words).
    }

    Under no circumstances make a second search or repeat tool calls. Output the JSON now.`,
    maxTurns: 10,
  },
  defaultOptions
);

