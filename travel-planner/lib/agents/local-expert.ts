import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface LocalInsight {
  type: 'hidden_gem' | 'local_favorite' | 'cultural_tip' | 'seasonal_event' | 'insider_secret';
  name: string;
  description: string;
  location: string;
  rating?: number;
  priceRange?: string;
  bestTime?: string;
  localTip?: string;
}

export interface LocalExpertAnalysis {
  insights: LocalInsight[];
  recommendations: string[];
  culturalTips: string[];
  seasonalAdvice: string[];
  searchQueries: string[];
  localSecrets: string[];
  confidence: number;
}

export class LocalExpert {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  }

  async analyze(city: string, interests: string): Promise<LocalExpertAnalysis> {
    console.log(`🗺️ Local Expert Agent: Analyzing ${city} for interests: ${interests}`);

    const prompt = `
      As a Local Expert AI agent for ${city}, provide deep insider knowledge and recommendations:
      
      City: ${city}
      Visitor Interests: ${interests}
      
      Your specialized expertise includes:
      1. Hidden gems that only locals know about (not in typical guidebooks)
      2. Authentic local experiences that avoid tourist traps
      3. Cultural insights, etiquette, and local customs
      4. Seasonal events and optimal timing for activities
      5. Local food scenes, markets, and dining customs
      6. Transportation secrets and local navigation tips
      7. Safety considerations and local advice
      8. Money-saving tips that locals use
      
      Generate specific search queries for TavilySearchResults to find:
      - Current local events and festivals
      - Hidden spots and local favorites
      - Recent changes in the city
      - Local food scene updates
      
      IMPORTANT: Provide insights specific to ${city}, not generic advice. Research the actual city and provide location-specific recommendations.
      
      Provide practical, actionable insights that will make visitors feel like locals.
    `;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              insights: {
                type: "ARRAY",
                description: "Specific local insights and hidden gems",
                items: {
                  type: "OBJECT",
                  properties: {
                    type: {
                      type: "STRING",
                      enum: ["hidden_gem", "local_favorite", "cultural_tip", "seasonal_event", "insider_secret"]
                    },
                    name: { type: "STRING" },
                    description: { type: "STRING" },
                    location: { type: "STRING" },
                    rating: { type: "NUMBER", minimum: 1, maximum: 5 },
                    priceRange: { type: "STRING" },
                    bestTime: { type: "STRING" },
                    localTip: { type: "STRING" }
                  },
                  required: ["type", "name", "description", "location"]
                }
              },
              recommendations: {
                type: "ARRAY",
                description: "General travel tips and recommendations",
                items: { type: "STRING" }
              },
              culturalTips: {
                type: "ARRAY",
                description: "Cultural etiquette and customs",
                items: { type: "STRING" }
              },
              seasonalAdvice: {
                type: "ARRAY",
                description: "Season-specific advice and considerations",
                items: { type: "STRING" }
              },
              localSecrets: {
                type: "ARRAY",
                description: "Insider secrets that locals know",
                items: { type: "STRING" }
              },
              confidence: {
                type: "NUMBER",
                minimum: 0,
                maximum: 1,
                description: "Confidence in local knowledge accuracy"
              }
            },
            required: ["insights", "recommendations", "culturalTips", "seasonalAdvice", "localSecrets", "confidence"]
          }
        }
      });

      const response = await result.response;
      const analysis = JSON.parse(response.text());

      // Generate search queries for TavilySearchResults
      analysis.searchQueries = this.generateSearchQueries(city, interests);

      console.log('✅ Local Expert Agent: Analysis complete', {
        insights: analysis.insights?.length || 0,
        recommendations: analysis.recommendations?.length || 0,
        confidence: analysis.confidence
      });

      return analysis;
    } catch (error) {
      console.error('❌ Local Expert Agent error:', error);
      throw new Error(
        `Local insights lookup failed: ${(error as Error)?.message || 'Unknown error'}`
      );
    }
  }

  private generateSearchQueries(city: string, interests: string): string[] {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });

    return [
      `${city} hidden gems locals only ${currentYear}`,
      `${city} authentic ${interests} experiences off beaten path`,
      `${city} local events festivals ${currentMonth} ${currentYear}`,
      `${city} best local food markets restaurants ${currentYear}`,
      `${city} insider tips locals secrets ${currentYear}`,
      `${city} cultural etiquette customs what locals do`
    ];
  }

  private getMockAnalysis(city: string, interests: string): LocalExpertAnalysis {
    // Generate city-specific insights based on the actual city name
    const insights = this.generateCitySpecificInsights(city, interests);

    return {
      insights,
      recommendations: [
        `Best time to visit ${city} is early morning or late afternoon`,
        'Learn basic local phrases - locals appreciate the effort',
        'Use public transportation like locals do',
        'Eat where locals eat, not where tourists gather',
        `Download local apps for ${city} transportation and dining`
      ],
      culturalTips: [
        'Respect local customs and traditions',
        'Dress appropriately for cultural sites',
        'Be mindful of local etiquette and social norms',
        'Tip according to local customs',
        'Ask permission before photographing people'
      ],
      seasonalAdvice: [
        'Check local weather patterns for your travel dates',
        'Book accommodations well in advance for peak season',
        'Pack appropriate clothing for the climate',
        'Stay hydrated and take breaks during extreme weather',
        'Consider local holidays and festivals in your planning'
      ],
      searchQueries: this.generateSearchQueries(city, interests),
      localSecrets: [
        `Local markets in ${city} offer the best authentic food experiences`,
        'Early morning visits to popular sites avoid crowds',
        'Local transportation passes often include museum discounts',
        'Neighborhood cafes are great for meeting locals',
        'Free walking tours provide excellent orientation'
      ],
      confidence: 0.88
    };
  }

  private generateCitySpecificInsights(city: string, interests: string): LocalInsight[] {
    const cityLower = city.toLowerCase();

    // European cities
    if (cityLower.includes('barcelona')) {
      return [
        {
          type: 'hidden_gem',
          name: 'Bunkers del Carmel',
          description: 'Former anti-aircraft bunkers with panoramic city views, especially stunning at sunset',
          location: 'El Carmel neighborhood',
          rating: 4.8,
          priceRange: 'Free',
          bestTime: 'Sunset',
          localTip: 'Bring water and wear comfortable shoes for the hike up'
        },
        {
          type: 'local_favorite',
          name: 'Mercat de Sant Antoni',
          description: 'Local market with authentic tapas bars and vintage book stalls',
          location: 'Sant Antoni',
          rating: 4.6,
          priceRange: '€€',
          bestTime: 'Sunday mornings',
          localTip: 'Try the vermut (vermouth) with locals on Sunday'
        }
      ];
    } else if (cityLower.includes('prague')) {
      return [
        {
          type: 'hidden_gem',
          name: 'Petřín Lookout Tower',
          description: 'Mini Eiffel Tower with incredible views, less crowded than Prague Castle',
          location: 'Petřín Hill',
          rating: 4.7,
          priceRange: '€',
          bestTime: 'Early morning',
          localTip: 'Take the funicular railway up to save energy'
        },
        {
          type: 'local_favorite',
          name: 'Lokál',
          description: 'Authentic Czech pub with the best goulash and fresh Pilsner',
          location: 'Multiple locations',
          rating: 4.8,
          priceRange: '€€',
          bestTime: 'Lunch time',
          localTip: 'Share tables with locals - it\'s normal and encouraged'
        }
      ];
    }

    // Asian cities
    else if (cityLower.includes('bangkok')) {
      return [
        {
          type: 'hidden_gem',
          name: 'Talad Rot Fai Ratchada',
          description: 'Night market with vintage finds and amazing street food',
          location: 'Ratchada',
          rating: 4.7,
          priceRange: '฿',
          bestTime: 'Evening after 6 PM',
          localTip: 'Take the MRT to Thailand Cultural Centre station'
        },
        {
          type: 'local_favorite',
          name: 'Khlong Toei Market',
          description: 'Authentic wholesale market where locals shop for fresh ingredients',
          location: 'Khlong Toei',
          rating: 4.5,
          priceRange: '฿',
          bestTime: 'Early morning 5-8 AM',
          localTip: 'Bring cash only and try the fresh fruit'
        }
      ];
    }

    // Default insights for any city
    return [
      {
        type: 'hidden_gem',
        name: `${city} Local Discovery`,
        description: 'Authentic local experience away from tourist crowds',
        location: 'City center',
        rating: 4.5,
        priceRange: 'Varies',
        bestTime: 'Early morning or late afternoon',
        localTip: 'Ask locals for their favorite spots'
      },
      {
        type: 'local_favorite',
        name: `${city} Neighborhood Gem`,
        description: 'Where locals go for authentic food and culture',
        location: 'Local neighborhood',
        rating: 4.6,
        priceRange: 'Budget-friendly',
        bestTime: 'Lunch or dinner time',
        localTip: 'Try the local specialties'
      },
      {
        type: 'cultural_tip',
        name: `${city} Cultural Insight`,
        description: 'Important cultural practice to know',
        location: 'Throughout the city',
        localTip: 'Respect local customs and traditions'
      }
    ];
  }
}