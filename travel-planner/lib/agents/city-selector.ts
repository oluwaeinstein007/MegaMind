import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface CityRecommendation {
  city: string;
  rating: number;
  highlights: string[];
  budget: string;
  bestFor: string;
  reasoning: string;
}

export interface CityAnalysis {
  selectedCity: string;
  alternatives: CityRecommendation[];
  searchQuery: string;
  calculations: any[];
  confidence: number;
  reasoning: string;
}

export class CitySelector {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  }

  async analyze(preferences: {
    destination: string;
    budget: string;
    interests: string;
    travelers: string;
    startDate?: string;
    endDate?: string;
    comingFrom?: string;
  }): Promise<CityAnalysis> {
    console.log('🏙️ City Selector Agent: Starting destination analysis');

    const prompt = `
      As a City Selector AI agent specialized in destination analysis, evaluate these travel preferences:
      
      Destination Preference: ${preferences.destination}
      Coming From: ${preferences.comingFrom || 'Not specified'}
      Budget Range: ${preferences.budget}
      Interests: ${preferences.interests}
      Number of Travelers: ${preferences.travelers}
      Travel Dates: ${preferences.startDate} to ${preferences.endDate}
      
      Your specialized tasks:
      1. Analyze destination compatibility with budget and interests
      2. Consider seasonal factors and travel dates
      3. Evaluate group size accommodations
      4. Factor in travel distance and logistics from origin
      5. Generate search queries for TavilySearchResults tool
      6. Provide 3 ranked city recommendations with detailed reasoning
      
      Consider factors:
      - Cost of living and travel expenses relative to budget
      - Alignment with stated interests and activities
      - Best travel seasons for the dates
      - Group size accommodations and logistics
      - Cultural activities and attractions
      - Safety and accessibility
      - Travel distance and flight connections from origin
      - Visa requirements and entry restrictions
      
      IMPORTANT: Do not default to Japan or any specific region. Analyze the actual destination preference provided: "${preferences.destination}"
      
      Provide detailed reasoning for each recommendation and overall confidence score.
    `;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              selectedCity: {
                type: "STRING",
                description: "The primary recommended city with country"
              },
              alternatives: {
                type: "ARRAY",
                description: "Array of 3 city recommendations",
                items: {
                  type: "OBJECT",
                  properties: {
                    city: { type: "STRING" },
                    rating: { type: "NUMBER", minimum: 1, maximum: 5 },
                    highlights: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                      minItems: 3,
                      maxItems: 5
                    },
                    budget: { type: "STRING" },
                    bestFor: { type: "STRING" },
                    reasoning: { type: "STRING" }
                  },
                  required: ["city", "rating", "highlights", "budget", "bestFor", "reasoning"]
                }
              },
              searchQuery: {
                type: "STRING",
                description: "Optimized search query for TavilySearchResults"
              },
              confidence: {
                type: "NUMBER",
                minimum: 0,
                maximum: 1,
                description: "Confidence score for recommendations"
              },
              reasoning: {
                type: "STRING",
                description: "Overall reasoning for the selection"
              }
            },
            required: ["selectedCity", "alternatives", "searchQuery", "confidence", "reasoning"]
          }
        }
      });

      const response = await result.response;
      const analysis = JSON.parse(response.text());

      // Add calculations metadata
      analysis.calculations = this.generateCalculations(preferences, analysis);

      console.log('✅ City Selector Agent: Analysis complete', {
        selectedCity: analysis.selectedCity,
        alternatives: analysis.alternatives?.length || 0,
        confidence: analysis.confidence
      });

      return analysis;
    } catch (error) {
      console.error('❌ City Selector Agent error:', error);
      throw new Error(
        `City selection failed: ${(error as Error)?.message || 'Unknown error'}`
      );
    }
  }

  private generateCalculations(preferences: any, analysis: any): any[] {
    const budgetMultiplier = preferences.budget === 'budget' ? 0.7 :
      preferences.budget === 'luxury' ? 1.5 : 1.0;

    return [
      {
        type: "budget_analysis",
        input: preferences.budget,
        dailyBudget: Math.round(180 * budgetMultiplier),
        breakdown: {
          accommodation: Math.round(80 * budgetMultiplier),
          food: Math.round(60 * budgetMultiplier),
          activities: Math.round(40 * budgetMultiplier)
        },
        confidence: analysis.confidence || 0.8
      },
      {
        type: "group_size_factor",
        travelers: preferences.travelers,
        multiplier: preferences.travelers === '5+' ? 1.2 : 1.0,
        considerations: ["Group discounts", "Accommodation requirements", "Transportation needs"]
      }
    ];
  }

  private getMockAnalysis(preferences: any): CityAnalysis {
    const budgetMultiplier = preferences.budget === 'budget' ? 0.7 :
      preferences.budget === 'luxury' ? 1.5 : 1.0;

    // Generate recommendations based on actual destination preference
    const destinationLower = preferences.destination.toLowerCase();
    let mockRecommendations: CityRecommendation[] = [];

    if (destinationLower.includes('europe')) {
      mockRecommendations = [
        {
          city: "Barcelona, Spain",
          rating: 4.8,
          highlights: ["Sagrada Familia", "Park Güell", "Gothic Quarter", "Beach Access"],
          budget: `$${Math.round(200 * budgetMultiplier)}/day`,
          bestFor: "Culture & Architecture",
          reasoning: "Perfect blend of culture, architecture, and Mediterranean lifestyle with excellent value for money."
        },
        {
          city: "Prague, Czech Republic",
          rating: 4.7,
          highlights: ["Prague Castle", "Charles Bridge", "Old Town Square", "Affordable Dining"],
          budget: `$${Math.round(150 * budgetMultiplier)}/day`,
          bestFor: "Budget-Friendly Culture",
          reasoning: "Stunning medieval architecture with very affordable prices and rich cultural experiences."
        },
        {
          city: "Amsterdam, Netherlands",
          rating: 4.6,
          highlights: ["Canal Tours", "Van Gogh Museum", "Vondelpark", "Bike Culture"],
          budget: `$${Math.round(250 * budgetMultiplier)}/day`,
          bestFor: "Art & Canals",
          reasoning: "Unique canal city with world-class museums and bike-friendly culture."
        }
      ];
    } else if (destinationLower.includes('asia')) {
      mockRecommendations = [
        {
          city: "Bangkok, Thailand",
          rating: 4.7,
          highlights: ["Grand Palace", "Floating Markets", "Street Food", "Temples"],
          budget: `$${Math.round(120 * budgetMultiplier)}/day`,
          bestFor: "Culture & Food",
          reasoning: "Incredible value with rich culture, amazing street food, and beautiful temples."
        },
        {
          city: "Singapore",
          rating: 4.8,
          highlights: ["Gardens by the Bay", "Marina Bay Sands", "Hawker Centers", "Clean & Safe"],
          budget: `$${Math.round(280 * budgetMultiplier)}/day`,
          bestFor: "Modern City Experience",
          reasoning: "Perfect blend of cultures with excellent infrastructure and diverse food scene."
        },
        {
          city: "Kyoto, Japan",
          rating: 4.9,
          highlights: ["Fushimi Inari", "Bamboo Grove", "Traditional Ryokans", "Temple Culture"],
          budget: `$${Math.round(220 * budgetMultiplier)}/day`,
          bestFor: "Traditional Culture",
          reasoning: "Authentic cultural experience with stunning temples and traditional accommodations."
        }
      ];
    } else {
      // Generic recommendations based on destination
      mockRecommendations = [
        {
          city: `${preferences.destination} - Top Choice`,
          rating: 4.7,
          highlights: ["Local Attractions", "Cultural Sites", "Great Food", "Friendly Locals"],
          budget: `$${Math.round(200 * budgetMultiplier)}/day`,
          bestFor: "Overall Experience",
          reasoning: `Excellent destination matching your preferences for ${preferences.interests} with good value for ${preferences.budget} budget.`
        },
        {
          city: `${preferences.destination} - Alternative 1`,
          rating: 4.5,
          highlights: ["Unique Experiences", "Local Culture", "Good Value", "Safe Travel"],
          budget: `$${Math.round(180 * budgetMultiplier)}/day`,
          bestFor: "Budget-Conscious",
          reasoning: "Great alternative with similar experiences at a more budget-friendly price point."
        },
        {
          city: `${preferences.destination} - Alternative 2`,
          rating: 4.6,
          highlights: ["Premium Experiences", "Luxury Options", "Exclusive Access", "High-End Dining"],
          budget: `$${Math.round(250 * budgetMultiplier)}/day`,
          bestFor: "Luxury Experience",
          reasoning: "Premium option with luxury accommodations and exclusive experiences."
        }
      ];
    }

    return {
      selectedCity: mockRecommendations[0].city,
      alternatives: mockRecommendations,
      searchQuery: `best ${preferences.destination} destinations ${preferences.budget} budget ${preferences.interests} ${new Date().getFullYear()}`,
      calculations: this.generateCalculations(preferences, { confidence: 0.85 }),
      confidence: 0.85,
      reasoning: `Based on your preference for ${preferences.destination} with a ${preferences.budget} budget and interests in ${preferences.interests}, these destinations offer the best combination of experiences suitable for ${preferences.travelers} travelers${preferences.comingFrom ? ` traveling from ${preferences.comingFrom}` : ''}.`
    };
  }
}