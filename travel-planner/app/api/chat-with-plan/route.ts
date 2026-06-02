// app/api/chat-with-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CacheManager, CACHE_KEYS, CacheKeyHelpers } from '@/lib/redis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyPatch } from 'fast-json-patch';
import { TavilySearchTool } from '@/lib/tools/tavily-search';

const tavilySearch = new TavilySearchTool();

// Helper: Detect if user message needs a web search
function detectSearchIntent(message: string): boolean {
  const searchTriggers = [
    /recommend/i, /suggest/i, /best\s+\w+/i, /where\s+(can|should|to)/i,
    /find\s+(me|a|the)/i, /looking\s+for/i, /any\s+(good|great)/i,
    /what('s|s|\s+is)\s+(the\s+)?(best|top|popular)/i, /hidden\s+gem/i,
    /local\s+(favorite|tip|secret)/i, /tiktok/i, /trending/i,
    /instagram/i, /viral/i, /reddit/i, /youtube/i,
    /current/i, /latest/i, /2024/i, /2025/i, /now/i,
    /book\s+(a|the)/i, /reservation/i, /ticket/i,
    /weather/i, /open\s+(now|today)/i, /hours/i,
  ];
  return searchTriggers.some(regex => regex.test(message));
}

// Helper: Extract what to search for
function extractSearchTopic(message: string, destination: string): string {
  const cleaned = message
    .replace(/can you|could you|please|i want|i need|i'm looking for|find me|recommend|suggest/gi, '')
    .replace(/in\s+\w+/gi, '')
    .trim();
  return cleaned.slice(0, 100);
}

export async function POST(req: NextRequest) {
  try {
    const {
      planId,
      message,
      role = 'user',
      currentPlan,
      chatHistory = [],
    } = await req.json();

    if (!planId || !message) {
      return NextResponse.json(
        { error: 'planId and message are required' },
        { status: 400 },
      );
    }

    // ── 1. Fetch (or seed) cached plan ────────────────────────────────────────────
    let planKey: string;

    if (planId.startsWith('travel_plan:')) {
      planKey = planId;
    } else if (planId === 'current' || planId.length < 20) {
      planKey = CACHE_KEYS.TRAVEL_PLAN(planId);
    } else {
      planKey = planId;
    }

    console.log(`[chat-with-plan] Using cache key: ${planKey}`);

    let plan = await CacheManager.get<any>(planKey);

    if (!plan && currentPlan) {
      const normalizedPlan = {
        itinerary: currentPlan.itinerary || null,
        recommendations: currentPlan.recommendations || [],
        workflow_data: currentPlan.workflow_data || {},
        orchestration: currentPlan.orchestration || {}
      };

      await CacheManager.set(planKey, normalizedPlan, 86_400);
      plan = normalizedPlan;
      console.log(`[chat-with-plan] seeded cache for ${planId}`);
    }

    if (currentPlan && plan) {
      const hasItinerary = !!currentPlan.itinerary;
      const cachedHasItinerary = !!plan.itinerary;

      if (hasItinerary && !cachedHasItinerary) {
        console.log(`[chat-with-plan] Updating cache with fresh itinerary data for ${planId}`);
        const normalizedPlan = {
          itinerary: currentPlan.itinerary || null,
          recommendations: currentPlan.recommendations || [],
          workflow_data: currentPlan.workflow_data || {},
          orchestration: currentPlan.orchestration || {}
        };

        await CacheManager.set(planKey, normalizedPlan, 86_400);
        plan = normalizedPlan;
      }
    }

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    console.log('[chat-with-plan] Plan structure:', {
      hasItinerary: !!plan.itinerary,
      planKeys: Object.keys(plan),
      scheduleLength: plan.itinerary?.schedule?.length,
    });

    // ── 2. Smart web search when needed ───────────────────────────────────────────
    const destination = plan.itinerary?.destination || currentPlan?.itinerary?.destination || 'the destination';
    const needsWebSearch = detectSearchIntent(message);

    let webSearchResults = '';
    let searchSources: string[] = [];

    if (needsWebSearch) {
      console.log('[chat-with-plan] 🔍 Performing smart web search...');
      try {
        const searchTopic = extractSearchTopic(message, destination);

        // Parallel search across multiple sources
        const searchPromises = [
          tavilySearch.search(`${destination} ${searchTopic}`, {
            max_results: 5,
            search_depth: 'advanced'
          }),
        ];

        // Add social media search for trending/recommendation queries
        if (/tiktok|trending|viral|instagram|hidden gem|local/i.test(message)) {
          searchPromises.push(tavilySearch.searchSocialMedia(destination, searchTopic));
        }

        // Add Reddit for authentic advice
        if (/reddit|authentic|real|honest|local tip/i.test(message)) {
          searchPromises.push(tavilySearch.searchReddit(destination, searchTopic));
        }

        const results = await Promise.all(searchPromises);
        const allResults = results.flatMap(r => r.results).slice(0, 10);

        if (allResults.length > 0) {
          searchSources = allResults.map(r => r.url);
          webSearchResults = `
### 🌐 Live Search Results (just searched the web for you):
${allResults.map((r, i) => `
**${i + 1}. ${r.title}**
Source: ${r.url}
${r.content.slice(0, 250)}${r.content.length > 250 ? '...' : ''}
`).join('\n')}`;
          console.log(`[chat-with-plan] Found ${allResults.length} search results`);
        }
      } catch (searchError) {
        console.error('[chat-with-plan] Web search failed:', searchError);
      }
    }

    // ── 3. Build personalized AI prompt ───────────────────────────────────────────
    const recentHistory = chatHistory.slice(-6).map((msg: any) =>
      `${msg.role === 'user' ? 'Traveler' : 'Luna'}: ${msg.content}`
    ).join('\n');

    const prompt = `
You are **Luna**, a warm, knowledgeable, and enthusiastic AI travel companion. You're like that friend who's been everywhere and genuinely loves helping others discover amazing places.

## Your Personality
- **Warm & Personal**: Talk like a trusted friend. Use "you" and "your" naturally. Be encouraging!
- **Enthusiastic**: Share genuine excitement! "Oh, you're going to absolutely love this spot!" 
- **Expert Knowledge**: You know destinations deeply—local spots, hidden gems, cultural nuances, timing tips
- **Proactive**: Suggest things they haven't thought of. Anticipate needs. Connect the dots.
- **Authentic**: Only reference REAL places. Never make up names or details.

## Your Superpowers
- Deep destination knowledge from traditional travel sources AND social media (TikTok trends, Reddit tips, YouTube vlogs)
- Cultural intelligence—customs, etiquette, what to wear, how to behave
- Budget optimization and value-finding expertise  
- Booking strategy (best times, how to get deals, reservation tips)
- Hidden gems that only locals and frequent travelers know
- Practical logistics (transportation, timing, weather considerations)

## Current Trip Context
**Destination**: ${destination}
**Their Itinerary**:
\`\`\`json
${JSON.stringify(plan.itinerary, null, 2)}
\`\`\`

${webSearchResults ? `## 🔍 Fresh Intel from the Web\nI just searched the internet for relevant information:\n${webSearchResults}` : ''}

${recentHistory ? `## Our Conversation So Far\n${recentHistory}` : ''}

## What They Just Said
"${message}"

## How to Respond
1. **Feel their intent**: Are they asking a question, wanting a change, or just chatting?
2. **Be genuinely helpful**: Give specific, actionable information
3. **Use web results naturally**: If I searched, weave those insights in conversationally (cite sources!)
4. **Keep it warm**: You're their travel buddy, not a robot

## Response Format (JSON)
{
  "interaction_type": "question" | "modification",
  "patch": [],
  "updated_rich_content": {
    "city_selection": "Updated Destination Selector markdown report (only if destination details changed, else empty or omit)",
    "local_exploration": "Updated Insider Guide markdown report (only if local tips/gems changed, else empty or omit)",
    "itinerary_design": "Updated Itinerary Planner markdown report (strongly recommended to update this to match the JSON patch changes so the markdown matches the structured visual dashboard!), keeping all headings, blockquotes, and lists beautiful",
    "booking_curation": "Updated Bookings Curator markdown report (only if bookings changed, else empty or omit)"
  },
  "assistant_response": "Your warm, markdown-formatted response. Be specific with real place names, addresses, tips. Include sources if you used web search.",
  "suggestions": ["3-4 natural follow-ups they might want to explore"],
  "sources": ["URLs you referenced from web search, if any"]
}

## For Modifications
If they want to CHANGE their itinerary, generate RFC-6902 JSON Patch operations in the "patch" array. Additionally, you MUST rewrite the relevant parts of the markdown reports in "updated_rich_content" (particularly "itinerary_design") so that they perfectly align with the JSON patch changes.

## Your Voice Examples
- "Ooh, great question! So here's the inside scoop on that..."
- "I actually just looked this up for you, and guess what I found..."  
- "You know what would be absolutely perfect here? Let me tell you about..."
- "Honestly? Skip [tourist trap] and go to [authentic spot] instead. Trust me!"
- "I love that you asked about this! There's this amazing place that most tourists never find..."

Remember: Be specific, be warm, be genuinely helpful. Make them feel like they have an expert friend helping them plan.
`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const geminiRes = await model.generateContent({
      contents: [{ role, parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    const { text } = await geminiRes.response;
    const rawText = text();

    // Parse JSON with error recovery for bad escape sequences
    let aiJson;
    try {
      aiJson = JSON.parse(rawText);
    } catch (parseError) {
      console.warn('[chat-with-plan] JSON parse failed, attempting recovery...');
      try {
        // Fix common escape issues: replace unescaped backslashes and control chars
        const fixedText = rawText
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\') // Escape lone backslashes
          .replace(/[\x00-\x1F\x7F]/g, ' '); // Remove control characters
        aiJson = JSON.parse(fixedText);
        console.log('[chat-with-plan] JSON recovery successful');
      } catch {
        // Final fallback: return a safe response
        console.error('[chat-with-plan] JSON recovery failed, using fallback');
        aiJson = {
          interaction_type: 'question',
          assistant_response: "I'd love to help you with that! Could you tell me a bit more about what you're looking for?",
          suggestions: ['Tell me more about your preferences', 'What activities interest you?'],
          patch: [],
          sources: searchSources
        };
      }
    }

    const interactionType = aiJson.interaction_type || 'question';
    const patch: any[] = Array.isArray(aiJson.patch) ? aiJson.patch : [];
    const assistantResponse: string = aiJson.assistant_response || 'I understand your request.';
    const suggestions: string[] = Array.isArray(aiJson.suggestions) ? aiJson.suggestions : [];
    const sources: string[] = Array.isArray(aiJson.sources) ? aiJson.sources : searchSources;

    console.log(`[chat-with-plan] Response: type=${interactionType}, patches=${patch.length}, sources=${sources.length}`);

    // ── 4. Apply patch if modification ────────────────────────────────────────────
    let patchApplied = false;
    if (patch.length > 0 || aiJson.updated_rich_content) {
      console.log(`[chat-with-plan] Applying ${patch.length} patch operations & rich content updates`);
      try {
        if (patch.length > 0) {
          const patched = applyPatch({ ...plan.itinerary }, patch, true, false);
          plan.itinerary = patched.newDocument;
          patchApplied = true;
        }

        // Apply updated rich content (markdown reports) from Gemini to maintain visual & report alignment
        if (aiJson.updated_rich_content) {
          const richContent = plan.workflow_data?.rich_content || plan.workflow_data?.workflow_data?.rich_content || plan.workflowData?.rich_content || {};
          
          if (aiJson.updated_rich_content.city_selection) {
            richContent.city_selection = aiJson.updated_rich_content.city_selection;
          }
          if (aiJson.updated_rich_content.local_exploration) {
            richContent.local_exploration = aiJson.updated_rich_content.local_exploration;
          }
          if (aiJson.updated_rich_content.itinerary_design) {
            richContent.itinerary_design = aiJson.updated_rich_content.itinerary_design;
          }
          if (aiJson.updated_rich_content.booking_curation) {
            richContent.booking_curation = aiJson.updated_rich_content.booking_curation;
          }

          // Merge back into workflow_data
          if (plan.workflow_data) {
            plan.workflow_data.rich_content = richContent;
          } else {
            plan.workflow_data = { rich_content: richContent };
          }
          patchApplied = true;
        }

        if (patchApplied) {
          await CacheManager.set(planKey, plan, 86_400);
          console.log(`[chat-with-plan] Plan updated and cached successfully`);
        }
      } catch (patchError) {
        console.error('[chat-with-plan] Patch/Rich content update failed:', patchError);
      }
    }

    // ── 5. Return response ────────────────────────────────────────────────────────
    return NextResponse.json({
      response: assistantResponse,
      suggestions,
      sources,
      interactionType,
      updatedPlan: patchApplied ? plan : null,
      webSearched: needsWebSearch && webSearchResults.length > 0,
    });
  } catch (err) {
    console.error('[chat-with-plan] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
