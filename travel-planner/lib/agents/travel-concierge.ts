import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchTopPlaces, fetchFlightOptions } from '../tools/tavily-wrapper';   // ← adjust path if needed

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface Activity {
  time: string;
  activity: string;
  type: 'transport' | 'accommodation' | 'sightseeing' | 'dining' | 'leisure' | 'shopping' | 'cultural';
  duration?: string;
  cost?: string;
  location?: string;
  specificPlace?: string;
  address?: string;
  coordinates?: { lat: number; lng: number };
  bookingRequired?: boolean;
  priority?: 'high' | 'medium' | 'low';
  notes?: string;
  image?: string;
  description?: string;
  tips?: string[];
  localCurrency?: string;
  culturalNotes?: string;
}

export interface DaySchedule {
  day: number;
  date: string;
  title: string;
  theme: string;
  activities: Activity[];
  dailyBudget: string;
  notes?: string[];
  weather?: string;
  transportation?: string;
  neighborhoods: string[];
  totalWalkingTime?: string;
  highlights: string[];
}

export interface TravelLogistics {
  schedule: DaySchedule[];
  totalBudget: {
    amount: string;
    currency: string;
    breakdown: {
      accommodation: string;
      food: string;
      activities: string;
      transport: string;
      misc: string;
    };
  };
  bookingInfo: {
    hotels: any[];
    flights: any[];
    activities: any[];
    restaurants: any[];
  };
  calculations: any[];
  logistics: {
    transportation: string;
    packingTips: string[];
    localTips: string[];
  };
  confidence: number;
}

export class TravelConcierge {
  private model: any;

  constructor() {
    this.model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  }

  async createItinerary(
    city: string,
    insights: any[],
    startDate: string,
    endDate: string,
    travelers: string,
    budget: string
  ): Promise<TravelLogistics> {
    console.log(`✈️ Travel Concierge Agent: Creating diverse itinerary for ${city}`);
    console.log(`📅 Date Range: startDate="${startDate}", endDate="${endDate}"`);

    const days = this.calculateDays(startDate, endDate);
    console.log(`📊 Calculated days: ${days}`);
    const daysToGenerate = Math.min(days, 15);
    console.log(`📊 Capping LLM generation to: ${daysToGenerate} days (full trip is ${days} days)`);

    const prompt = `
As a Travel Concierge AI agent, create a comprehensive and DIVERSE travel logistics plan for ${city}:

Trip Details:
- Destination: ${city}
- Dates: ${startDate} to ${endDate}
- Full Duration: ${days} days
- NUMBER OF DAYS TO GENERATE: ${daysToGenerate} days (To prevent token output limit truncation, you MUST generate detailed day-by-day schedules for EXACTLY the first ${daysToGenerate} days only. Do not exceed ${daysToGenerate} day entries in the schedule array. The system will automatically handle extending/padding the remaining days of the ${days}-day trip).
- Travelers: ${travelers}
- Budget Range: ${budget}
- Local Insights: ${JSON.stringify(insights)}

CRITICAL REQUIREMENTS:
1. **YOU MUST GENERATE EXACTLY THE FIRST ${daysToGenerate} DAYS** - The schedule array must contain exactly ${daysToGenerate} entries, one for each day from Day 1 to Day ${daysToGenerate}.
2. Each day must have a UNIQUE theme and completely different activities
3. Include SPECIFIC places with actual names, addresses, and descriptions
4. Vary neighborhoods - explore different areas of ${city} each day
5. Include diverse activity types: cultural, food, nature, shopping, entertainment
6. Provide specific restaurant names, attraction names, and exact locations
7. Include realistic timing and logical geographical routing
8. Add specific tips and insider knowledge for each location
9. Cover the first ${daysToGenerate}-day span in detail, creating new themes when templates run out.

MANDATORY: Generate a schedule array with EXACTLY ${daysToGenerate} entries, one for each day from Day 1 to Day ${daysToGenerate}.

Day Themes (examples – feel free to add more for longer trips):
- Historic & Cultural Exploration
- Food & Market Discovery
- Nature & Outdoor Adventures
- Art & Museum Day
- Local Neighborhoods & Hidden Gems
- Shopping & Entertainment
- Relaxation & Wellness
- Day Trips & Excursions
- Photography & Scenic Routes
- Nightlife & Evening Entertainment
- Adventure & Extreme Activities
- Local Crafts & Workshops

FOR EACH ACTIVITY, INCLUDE:
- **Tips**: Practical insider knowledge (e.g., "Ask for today's special", "Best time to visit is early morning", "Say 'anyeonghaseyo' as greeting", "Try the local delicacy")
- **Exact Location**: Specific address, district, or landmark
- **Local Currency Amount**: Prices in local currency (e.g., "₩15,000" for Seoul, "€25" for Paris, "¥3,000" for Tokyo)
- **Cultural Context**: What makes this place special, local customs, or etiquette tips
- **Booking Requirements**: Whether advance booking is needed

Make each activity feel like having a local tour guide providing insider knowledge and cultural context.

FINAL REMINDER: The schedule array MUST have exactly ${daysToGenerate} day entries, numbered Day 1 through Day ${daysToGenerate}.`;

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              schedule: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    day: { type: 'NUMBER' },
                    date: { type: 'STRING' },
                    title: { type: 'STRING' },
                    theme: { type: 'STRING' },
                    activities: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          time: { type: 'STRING' },
                          activity: { type: 'STRING' },
                          type: { type: 'STRING' },
                          duration: { type: 'STRING' },
                          cost: { type: 'STRING' },
                          location: { type: 'STRING' },
                          specificPlace: { type: 'STRING' },
                          address: { type: 'STRING' },
                          description: { type: 'STRING' },
                          tips: {
                            type: 'ARRAY',
                            items: { type: 'STRING' }
                          },
                          localCurrency: { type: 'STRING' },
                          culturalNotes: { type: 'STRING' },
                          bookingRequired: { type: 'BOOLEAN' }
                        },
                        required: ['time', 'activity', 'type', 'tips', 'localCurrency']
                      }
                    },
                    dailyBudget: { type: 'STRING' },
                    highlights: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    }
                  },
                  required: ['day', 'date', 'title', 'activities', 'dailyBudget']
                }
              },
              totalBudget: {
                type: 'OBJECT',
                properties: {
                  amount: { type: 'STRING' },
                  breakdown: {
                    type: 'OBJECT',
                    properties: {
                      accommodation: { type: 'STRING' },
                      food: { type: 'STRING' },
                      activities: { type: 'STRING' },
                      transportation: { type: 'STRING' }
                    },
                    required: ['accommodation', 'food', 'activities', 'transportation']
                  }
                },
                required: ['amount', 'breakdown']
              },
              logistics: {
                type: 'OBJECT',
                properties: {
                  transportation: { type: 'STRING' },
                  packingTips: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  },
                  localTips: {
                    type: 'ARRAY',
                    items: { type: 'STRING' }
                  }
                },
                required: ['transportation', 'packingTips', 'localTips']
              },
              confidence: { type: 'NUMBER', minimum: 0, maximum: 1 }
            },
            required: ['schedule', 'totalBudget', 'logistics', 'confidence']
          }
        }
      });

      const response = await result.response;
      const responseText = response.text();

      // Try to parse JSON, with recovery for truncated responses
      let itinerary;
      try {
        itinerary = JSON.parse(responseText);
      } catch (parseError) {
        console.warn('⚠️ JSON parse failed, attempting recovery...', parseError);
        // Try to fix common JSON issues
        const fixedJson = this.attemptJsonRecovery(responseText);
        if (fixedJson) {
          itinerary = fixedJson;
          console.log('✅ JSON recovery successful');
        } else {
          throw parseError; // Re-throw to fall back to mock
        }
      }

      // Ensure we have exactly the right number of days
      itinerary.schedule = this.ensureCorrectDays(
        itinerary.schedule || [],
        days,
        city,
        startDate
      );

      // add calculations & bookings
      itinerary.calculations = this.generateCalculations(days, budget, travelers);
      itinerary.bookingInfo = await this.generateBookingInfo(
        city,
        startDate,
        endDate,
        itinerary.schedule
      );

      console.log('✅ Travel Concierge Agent: Diverse itinerary complete', {
        days: itinerary.schedule?.length || 0,
        expectedDays: days,
        totalBudget: itinerary.totalBudget?.amount,
        confidence: itinerary.confidence
      });

      return itinerary as TravelLogistics;
    } catch (err) {
      console.error('❌ Travel Concierge Agent error – using mock:', err);
      return await this.getMockItinerary(
        city,
        startDate,
        endDate,
        travelers,
        budget,
        insights
      );
    }
  }

  /**
   * Attempt to recover from truncated or malformed JSON responses
   */
  private attemptJsonRecovery(text: string): any | null {
    try {
      // Remove any trailing incomplete content and try to close brackets
      let fixed = text.trim();

      // Count open brackets
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;

      // If we're in the middle of a string, try to close it
      if (fixed.includes('"') && !fixed.endsWith('"') && !fixed.endsWith('}') && !fixed.endsWith(']')) {
        // Find the last complete structure
        const lastCompleteObject = fixed.lastIndexOf('},');
        const lastCompleteArray = fixed.lastIndexOf('],');
        const lastComplete = Math.max(lastCompleteObject, lastCompleteArray);

        if (lastComplete > fixed.length * 0.7) { // Only if we have most of the content
          fixed = fixed.substring(0, lastComplete + 1);
        }
      }

      // Add missing closing brackets
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

  /* ───────────────────────── helpers ───────────────────────── */

  private calculateDays(startDate: string, endDate: string): number {
    console.log(`🔢 calculateDays input: startDate="${startDate}", endDate="${endDate}"`);

    // Validate inputs
    if (!startDate || !endDate) {
      console.warn('⚠️ Missing dates, defaulting to 7 days');
      return 7;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Check for invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('⚠️ Invalid date format, defaulting to 7 days');
      return 7;
    }

    const diff = Math.abs(end.valueOf() - start.valueOf());
    const days = Math.max(1, Math.ceil(diff / 86_400_000)); // ms per day

    // Add +1 because we include both start and end day
    const totalDays = days + 1;
    console.log(`📊 Calculated: ${totalDays} days (including both start and end day)`);

    return totalDays;
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
    schedule: DaySchedule[],
    expectedDays: number,
    city: string,
    startDate: string
  ): DaySchedule[] {
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
  private generateCalculations(days: number, budget: string, travelers: string) {
    const multiplier = budget === 'budget' ? 0.7 : budget === 'luxury' ? 1.5 : 1;
    const group = travelers === '5+' ? 1.2 : 1;
    const daily = Math.round(250 * multiplier * group);

    return [
      {
        type: 'daily_budget_breakdown',
        totalDaily: daily,
        accommodation: Math.round(daily * 0.35),
        food: Math.round(daily * 0.30),
        activities: Math.round(daily * 0.25),
        transport: Math.round(daily * 0.10),
        days,
        totalTrip: daily * days
      },
      {
        type: 'group_considerations',
        travelers,
        groupMultiplier: group,
        considerations: [
          'Group discounts for activities',
          'Shared accommodation costs',
          'Transportation efficiency for groups'
        ]
      }
    ];
  }

  private async generateBookingInfo(
    city: string,
    startDate: string,
    endDate: string,
    schedule: any[]
  ) {
    try {
      // Get real booking options with enhanced search
      const [hotels, restaurants, activities] = await Promise.all([
        fetchTopPlaces(city, 'hotel', 6),
        fetchTopPlaces(city, 'restaurant', 8),
        fetchTopPlaces(city, 'activity', 10)
      ]);

      // Generate flight options (assuming international travel)
      const flights = await fetchFlightOptions(
        'International Departure',
        city,
        startDate,
        endDate
      );

      // Extract restaurant recommendations from schedule
      const scheduledRestaurants = schedule
        .flatMap(day => day.activities || [])
        .filter(activity => activity.type === 'dining' || activity.type === 'Food')
        .map(activity => ({
          name: activity.activity || activity.specificPlace || 'Restaurant',
          link: `https://www.opentable.com/s?query=${encodeURIComponent(activity.activity || activity.specificPlace || city)}`,
          blurb: activity.description || `Recommended dining spot in ${city}`,
          category: 'restaurant',
          city: city,
          scheduledTime: activity.time,
          cost: activity.cost
        }));

      // Extract activity bookings from schedule
      const scheduledActivities = schedule
        .flatMap(day => day.activities || [])
        .filter(activity => activity.bookingRequired || activity.type === 'Cultural' || activity.type === 'Entertainment')
        .map(activity => ({
          name: activity.activity || activity.specificPlace || 'Activity',
          link: `https://www.getyourguide.com/s/?q=${encodeURIComponent(activity.activity || activity.specificPlace || city)}`,
          blurb: activity.description || `${activity.activity} - ${activity.duration || 'Duration varies'}`,
          category: 'activity',
          city: city,
          scheduledTime: activity.time,
          cost: activity.cost,
          bookingRequired: activity.bookingRequired || false
        }));

      return {
        hotels: hotels.slice(0, 5),
        restaurants: [
          ...scheduledRestaurants.slice(0, 3),
          ...restaurants.filter(r =>
            !scheduledRestaurants.some(sr =>
              sr.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0])
            )
          ).slice(0, 3)
        ],
        activities: [
          ...scheduledActivities.slice(0, 4),
          ...activities.filter(a =>
            !scheduledActivities.some(sa =>
              sa.name.toLowerCase().includes(a.name.toLowerCase().split(' ')[0])
            )
          ).slice(0, 4)
        ],
        flights: flights,
        bookingTips: [
          `Book accommodations in ${city} at least 2-3 weeks in advance`,
          'Many restaurants in ' + city + ' require reservations, especially for dinner',
          'Popular attractions may sell out - book tickets online in advance',
          'Consider purchasing a city pass for multiple attractions',
          'Download local transport apps for easy navigation'
        ],
        localBookingServices: {
          transportation: `${city} local transport passes and ride-sharing apps`,
          tours: `Local tour operators and guides in ${city}`,
          experiences: `Cultural experiences and workshops in ${city}`
        }
      };
    } catch (error) {
      console.error('Error generating booking info:', error);
      // Fallback to basic booking information
      return this.getFallbackBookingInfo(city, startDate, endDate);
    }
  }

  private getFallbackBookingInfo(city: string, startDate: string, endDate: string) {
    const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return {
      hotels: [
        {
          name: `Best Hotels in ${city}`,
          link: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&dest_type=city`,
          blurb: `Find and book the perfect hotel in ${city} with flexible cancellation options.`,
          category: 'hotel',
          city: city
        },
        {
          name: `Luxury Accommodations ${city}`,
          link: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(city)}`,
          blurb: `Premium hotels and resorts in ${city} for a memorable stay.`,
          category: 'hotel',
          city: city
        }
      ],
      restaurants: [
        {
          name: `Top Restaurants in ${city}`,
          link: `https://www.opentable.com/s?query=${encodeURIComponent(city)}`,
          blurb: `Make reservations at the best restaurants in ${city}.`,
          category: 'restaurant',
          city: city
        }
      ],
      activities: [
        {
          name: `Things to Do in ${city}`,
          link: `https://www.getyourguide.com/s/?q=${encodeURIComponent(city)}`,
          blurb: `Book tours, attractions, and experiences in ${city}.`,
          category: 'activity',
          city: city
        }
      ],
      flights: [
        {
          type: 'Flight Search' as const,
          departure: 'Your Location',
          arrival: city,
          departureDate: startDate,
          returnDate: endDate,
          bookingLink: `https://www.skyscanner.com/routes/your-location/${citySlug}`,
          notes: 'Compare flight prices and find the best deals',
          estimatedPrice: 'Varies by departure location and season'
        }
      ],
      bookingTips: [
        'Book early for better prices and availability',
        'Check cancellation policies before booking',
        'Consider travel insurance for international trips',
        'Keep confirmation numbers and booking details handy'
      ]
    };
  }

  /* ───────────── mock fallback + city‑specific builders ───────────── */

  private async getMockItinerary(
    city: string,
    startDate: string,
    endDate: string,
    travelers: string,
    budget: string,
    insights: any[]
  ): Promise<TravelLogistics> {
    const days = this.calculateDays(startDate, endDate);
    console.log(`🎯 Mock itinerary generating ${days} days for ${city}`);
    const bMult = budget === 'budget' ? 0.7 : budget === 'luxury' ? 1.5 : 1;
    const dailyBudget = Math.round(250 * bMult);
    const schedule = this.generateCitySpecificItinerary(
      city,
      startDate,
      days,
      dailyBudget,
      insights
    );
    console.log(`📅 Generated schedule with ${schedule.length} days`);

    return {
      schedule,
      totalBudget: {
        amount: `$${dailyBudget * days}`,
        currency: 'USD',
        breakdown: {
          accommodation: `$${Math.round(dailyBudget * 0.35 * days)} (35%)`,
          food: `$${Math.round(dailyBudget * 0.30 * days)} (30%)`,
          activities: `$${Math.round(dailyBudget * 0.25 * days)} (25%)`,
          transport: `$${Math.round(dailyBudget * 0.10 * days)} (10%)`,
          misc: `$${Math.round(dailyBudget * 0.05 * days)} (5%)`
        }
      },
      bookingInfo: await this.generateBookingInfo(city, startDate, endDate, schedule),
      calculations: this.generateCalculations(days, budget, travelers),
      logistics: {
        transportation: `Purchase ${city} local transportation pass; Download ${city} transit app; Keep emergency taxi numbers handy`,
        packingTips: [
          'Comfortable walking shoes',
          'Weather-appropriate clothing',
          'Portable charger & adapters',
          'Travel insurance documents',
          `Local currency for ${city}`
        ],
        localTips: [
          `Research ${city} local customs`,
          'Learn basic local phrases',
          'Download offline maps',
          'Keep emergency contacts handy',
          'Check local weather forecasts'
        ]
      },
      confidence: 0.92
    };
  }

  private generateCitySpecificItinerary(
    city: string,
    startDate: string,
    days: number,
    dailyBudget: number,
    insights: any[]
  ): DaySchedule[] {
    const c = city.toLowerCase();
    if (c.includes('barcelona')) return this.generateBarcelonaItinerary(startDate, days, dailyBudget);
    if (c.includes('tokyo')) return this.generateTokyoItinerary(startDate, days, dailyBudget);
    if (c.includes('bangkok')) return this.generateBangkokItinerary(startDate, days, dailyBudget);
    if (c.includes('prague')) return this.generatePragueItinerary(startDate, days, dailyBudget);
    if (c.includes('singapore')) return this.generateSingaporeItinerary(startDate, days, dailyBudget);
    if (c.includes('amsterdam')) return this.generateAmsterdamItinerary(startDate, days, dailyBudget);
    if (c.includes('seoul')) return this.generateSeoulItinerary(startDate, days, dailyBudget);
    return this.generateGenericDiverseItinerary(city, startDate, days, dailyBudget, insights);
  }

  /* ─────────────── city builders (only change is length→days) ─────────────── */

  private generateBarcelonaItinerary(startDate: string, days: number, dailyBudget: number): DaySchedule[] {
    const themes = [
      { title: "Gaudí's Architectural Wonders", theme: 'Architecture & Art', neighborhoods: ['Eixample', 'Gràcia'] },
      { title: 'Gothic Quarter & Historic Barcelona', theme: 'History & Culture', neighborhoods: ['Barrio Gótico', 'El Born'] },
      { title: 'Beach, Markets & Local Life', theme: 'Local Life & Relaxation', neighborhoods: ['Barceloneta', 'El Raval'] },
      { title: 'Montjuïc & Panoramic Views', theme: 'Nature & Views', neighborhoods: ['Montjuïc', 'Poble Sec'] },
      { title: 'Food Tour & Tapas Culture', theme: 'Culinary Adventure', neighborhoods: ['Gràcia', 'Sant Antoni'] }
    ];
    // const activities: any[] = [ /* … original three‑day arrays … */ ];
    const activities = [
      // Day 1: Gaudí's Architecture
      [
        {
          time: "09:00",
          activity: "Sagrada Familia Guided Tour",
          type: "cultural" as const,
          specificPlace: "Basílica de la Sagrada Família",
          address: "Carrer de Mallorca, 401, 08013 Barcelona",
          description: "Gaudí's masterpiece basilica with intricate facades and stunning interior light play",
          duration: "2 hours",
          cost: "$35",
          bookingRequired: true,
          tips: ["Book skip-the-line tickets in advance", "Visit early to avoid crowds", "Audio guide highly recommended"],
          image: "https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=400"
        },
        {
          time: "12:00",
          activity: "Lunch at Casa Calvet Restaurant",
          type: "dining" as const,
          specificPlace: "Casa Calvet",
          address: "Carrer de Casp, 48, 08010 Barcelona",
          description: "Michelin-starred restaurant in a Gaudí-designed building serving modern Catalan cuisine",
          duration: "1.5 hours",
          cost: "$65",
          tips: ["Try the tasting menu", "Reservations essential", "Dress code: smart casual"]
        },
        {
          time: "15:00",
          activity: "Park Güell Exploration",
          type: "sightseeing" as const,
          specificPlace: "Park Güell",
          address: "Carrer d'Olot, s/n, 08024 Barcelona",
          description: "Whimsical park with colorful mosaics, unique architecture, and city views",
          duration: "2.5 hours",
          cost: "$15",
          bookingRequired: true,
          tips: ["Wear comfortable shoes", "Best photos at the mosaic bench", "Free areas available outside the monument zone"]
        },
        {
          time: "19:30",
          activity: "Sunset at Bunkers del Carmel",
          type: "leisure" as const,
          specificPlace: "Bunkers del Carmel",
          address: "Carrer de Marià Labèrnia, s/n, 08032 Barcelona",
          description: "Former anti-aircraft bunkers offering 360° panoramic views of Barcelona",
          duration: "1.5 hours",
          cost: "Free",
          tips: ["Bring water and snacks", "Arrive 30 minutes before sunset", "Can be crowded on weekends"]
        }
      ],
      // Day 2: Gothic Quarter
      [
        {
          time: "09:30",
          activity: "Barcelona Cathedral & Cloister",
          type: "cultural" as const,
          specificPlace: "Cathedral of the Holy Cross and Saint Eulalia",
          address: "Pla de la Seu, s/n, 08002 Barcelona",
          description: "Gothic cathedral with beautiful cloister, rooftop access, and 13 white geese",
          duration: "1.5 hours",
          cost: "$8",
          tips: ["Free entry during prayer times", "Rooftop offers great views", "Look for the 13 geese in the cloister"]
        },
        {
          time: "11:30",
          activity: "Picasso Museum Visit",
          type: "cultural" as const,
          specificPlace: "Museu Picasso",
          address: "Carrer Montcada, 15-23, 08003 Barcelona",
          description: "Extensive collection of Picasso's early works in beautiful medieval palaces",
          duration: "2 hours",
          cost: "$14",
          bookingRequired: true,
          tips: ["Free first Sunday of each month", "Audio guide available", "Photography not allowed"]
        },
        {
          time: "14:00",
          activity: "Lunch at Cal Pep Tapas Bar",
          type: "dining" as const,
          specificPlace: "Cal Pep",
          address: "Plaça de les Olles, 8, 08003 Barcelona",
          description: "Legendary tapas bar known for fresh seafood and standing-room-only atmosphere",
          duration: "1 hour",
          cost: "$45",
          tips: ["No reservations - arrive early", "Try the fried artichokes", "Cash only"]
        },
        {
          time: "16:00",
          activity: "El Born Cultural Center",
          type: "cultural" as const,
          specificPlace: "El Born Centre de Cultura i Memòria",
          address: "Plaça Comercial, 12, 08003 Barcelona",
          description: "Archaeological site and cultural center in a beautiful iron market building",
          duration: "1.5 hours",
          cost: "$6",
          tips: ["See the preserved medieval streets", "Free on Sundays after 3pm", "Interactive exhibits available"]
        },
        {
          time: "18:30",
          activity: "Cocktails at Paradiso",
          type: "leisure" as const,
          specificPlace: "Paradiso",
          address: "Carrer de Rera Palau, 4, 08003 Barcelona",
          description: "Hidden speakeasy behind a pastrami shop, world's 3rd best bar",
          duration: "2 hours",
          cost: "$18 per cocktail",
          bookingRequired: true,
          tips: ["Enter through the fridge door", "Reservations essential", "Try their signature cocktails"]
        }
      ],
      // Day 3: Beach & Markets
      [
        {
          time: "08:30",
          activity: "La Boquería Market Food Tour",
          type: "cultural" as const,
          specificPlace: "Mercat de la Boquería",
          address: "La Rambla, 91, 08001 Barcelona",
          description: "Famous food market with fresh produce, jamón, and local delicacies",
          duration: "2 hours",
          cost: "$25",
          tips: ["Avoid peak tourist hours", "Try fresh fruit juices", "Sample jamón ibérico"]
        },
        {
          time: "11:00",
          activity: "Beach Time at Barceloneta",
          type: "leisure" as const,
          specificPlace: "Platja de la Barceloneta",
          address: "Passeig Marítim de la Barceloneta, 08003 Barcelona",
          description: "Barcelona's most famous beach with golden sand and beach bars",
          duration: "3 hours",
          cost: "Free",
          tips: ["Rent umbrellas and chairs", "Watch for pickpockets", "Try paella at a chiringuito"]
        },
        {
          time: "14:30",
          activity: "Seafood Lunch at Can Majó",
          type: "dining" as const,
          specificPlace: "Can Majó",
          address: "Carrer de l'Almirall Aixada, 23, 08003 Barcelona",
          description: "Traditional seafood restaurant with beachfront terrace and excellent paella",
          duration: "1.5 hours",
          cost: "$55",
          tips: ["Try the black rice paella", "Reservations recommended", "Great sea views from terrace"]
        },
        {
          time: "17:00",
          activity: "Cable Car to Montjuïc",
          type: "transport" as const,
          specificPlace: "Telefèric de Montjuïc",
          address: "Avinguda Miramar, 30, 08038 Barcelona",
          description: "Scenic cable car ride offering spectacular views of the city and coastline",
          duration: "30 minutes",
          cost: "$13",
          tips: ["Best views on clear days", "Can be windy", "Combined tickets available"]
        },
        {
          time: "18:00",
          activity: "Magic Fountain Show",
          type: "leisure" as const,
          specificPlace: "Font Màgica de Montjuïc",
          address: "Plaça de Carles Buïgas, 1, 08038 Barcelona",
          description: "Spectacular water, light, and music show at the foot of Montjuïc",
          duration: "1 hour",
          cost: "Free",
          tips: ["Shows every 30 minutes", "Arrive early for good spots", "Bring a light jacket"]
        }
      ]
    ];

    return Array.from({ length: days }, (_, i) => {
      const idx = i % themes.length;
      return {
        day: i + 1,
        date: this.addDays(startDate, i),
        title: themes[idx].title,
        theme: themes[idx].theme,
        activities: activities[idx] || activities[0],
        dailyBudget: `$${dailyBudget}`,
        neighborhoods: themes[idx].neighborhoods,
        highlights: (activities[idx] || activities[0]).map((a: any) => a.specificPlace),
        notes: [
          'Comfortable walking shoes essential',
          'Many attractions offer student/senior discounts',
          'Siesta time: 2‑5 PM many shops close',
          'Dinner typically starts after 9 PM'
        ]
      };
    });
  }

  private generateTokyoItinerary(startDate: string, days: number, dailyBudget: number): DaySchedule[] {
    const themes = [
      { title: 'Traditional Tokyo: Temples & Gardens', theme: 'Culture & Tradition', neighborhoods: ['Asakusa', 'Ueno'] },
      { title: 'Modern Tokyo: Shibuya & Harajuku', theme: 'Modern Culture & Fashion', neighborhoods: ['Shibuya', 'Harajuku'] },
      { title: 'Tsukiji Market & Ginza Luxury', theme: 'Food & Shopping', neighborhoods: ['Tsukiji', 'Ginza'] },
      { title: 'Otaku Culture: Akihabara & Anime', theme: 'Pop Culture', neighborhoods: ['Akihabara', 'Ikebukuro'] },
      { title: 'Day Trip to Mount Fuji', theme: 'Nature & Adventure', neighborhoods: ['Kawaguchi‑ko', 'Hakone'] }
    ];
    const activities = [
      // Day 1: Traditional Tokyo
      [
        {
          time: "08:00",
          activity: "Senso-ji Temple Morning Visit",
          type: "cultural" as const,
          specificPlace: "Senso-ji Temple",
          address: "2-3-1 Asakusa, Taito City, Tokyo 111-0032",
          description: "Tokyo's oldest temple with traditional architecture and bustling Nakamise shopping street",
          duration: "2 hours",
          cost: "Free",
          tips: ["Visit early to avoid crowds", "Try traditional snacks on Nakamise-dori", "Purify hands and mouth at the fountain"],
          image: "https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=400"
        },
        {
          time: "11:00",
          activity: "Traditional Breakfast at Daikokuya Tempura",
          type: "dining" as const,
          specificPlace: "Daikokuya Tempura",
          address: "1-38-10 Asakusa, Taito City, Tokyo 111-0032",
          description: "Historic tempura restaurant serving crispy tempura since 1887",
          duration: "1 hour",
          cost: "$35",
          tips: ["Try the tendon (tempura rice bowl)", "Cash only", "Popular with locals"]
        },
        {
          time: "13:00",
          activity: "Ueno Park & Tokyo National Museum",
          type: "cultural" as const,
          specificPlace: "Tokyo National Museum",
          address: "13-9 Uenokoen, Taito City, Tokyo 110-8712",
          description: "Japan's largest collection of cultural artifacts including samurai swords and Buddhist art",
          duration: "2.5 hours",
          cost: "$7",
          tips: ["Free on International Museum Day", "Beautiful cherry blossoms in spring", "Audio guide available"]
        },
        {
          time: "16:30",
          activity: "Traditional Tea Ceremony",
          type: "cultural" as const,
          specificPlace: "Urasenke Foundation",
          address: "Omotesenke Fushin-an, Kamigyo Ward, Kyoto",
          description: "Authentic tea ceremony experience learning the way of tea",
          duration: "1.5 hours",
          cost: "$45",
          bookingRequired: true,
          tips: ["Wear comfortable clothes", "Remove shoes", "Learn proper etiquette"]
        },
        {
          time: "19:00",
          activity: "Dinner in Omoide Yokocho",
          type: "dining" as const,
          specificPlace: "Omoide Yokocho (Memory Lane)",
          address: "1-2 Nishishinjuku, Shinjuku City, Tokyo 160-0023",
          description: "Narrow alleyways with tiny yakitori stalls and authentic atmosphere",
          duration: "2 hours",
          cost: "$40",
          tips: ["Very small spaces", "Cash only", "Try different stalls", "Bow when entering"]
        }
      ],
      // Day 2: Modern Tokyo
      [
        {
          time: "09:00",
          activity: "Shibuya Crossing Experience",
          type: "sightseeing" as const,
          specificPlace: "Shibuya Crossing",
          address: "Shibuya City, Tokyo 150-0043",
          description: "World's busiest pedestrian crossing with up to 3,000 people crossing at once",
          duration: "1 hour",
          cost: "Free",
          tips: ["Best view from Starbucks overlooking crossing", "Rush hours are most impressive", "Take photos from Sky observation deck"]
        },
        {
          time: "10:30",
          activity: "Harajuku Fashion District",
          type: "shopping" as const,
          specificPlace: "Takeshita Street",
          address: "Takeshita-dori, Shibuya City, Tokyo 150-0001",
          description: "Colorful street famous for youth fashion, cosplay, and quirky shops",
          duration: "2 hours",
          cost: "$30",
          tips: ["Try rainbow cotton candy", "Look for unique fashion items", "Street performers on weekends"]
        },
        {
          time: "13:00",
          activity: "Lunch at Kawaii Monster Cafe",
          type: "dining" as const,
          specificPlace: "Kawaii Monster Cafe",
          address: "4F YM Square Bldg, 4-31-10 Jingumae, Shibuya City, Tokyo",
          description: "Colorful themed cafe with monster decorations and Instagram-worthy food",
          duration: "1.5 hours",
          cost: "$25",
          bookingRequired: true,
          tips: ["Very colorful and loud", "Great for photos", "Unique themed dishes"]
        },
        {
          time: "15:30",
          activity: "Meiji Shrine Visit",
          type: "cultural" as const,
          specificPlace: "Meiji Shrine",
          address: "1-1 Kamizono-cho, Shibuya City, Tokyo 151-8557",
          description: "Peaceful Shinto shrine dedicated to Emperor Meiji, surrounded by forest",
          duration: "1.5 hours",
          cost: "Free",
          tips: ["Write wishes on ema wooden plaques", "Witness traditional wedding ceremonies", "Peaceful contrast to busy Harajuku"]
        },
        {
          time: "18:00",
          activity: "Robot Restaurant Show",
          type: "leisure" as const,
          specificPlace: "Robot Restaurant",
          address: "1-7-1 Kabukicho, Shinjuku City, Tokyo 160-0021",
          description: "Bizarre and entertaining robot show with lights, music, and mechanical mayhem",
          duration: "1.5 hours",
          cost: "$65",
          bookingRequired: true,
          tips: ["Very loud and flashy", "No actual restaurant", "Unique Tokyo experience"]
        }
      ]
    ];

    return Array.from({ length: days }, (_, i) => {
      const idx = i % themes.length;
      return {
        day: i + 1,
        date: this.addDays(startDate, i),
        title: themes[idx].title,
        theme: themes[idx].theme,
        activities: activities[idx] || activities[0],
        dailyBudget: `$${dailyBudget}`,
        neighborhoods: themes[idx].neighborhoods,
        highlights: (activities[idx] || activities[0]).map((a: any) => a.specificPlace),
        notes: [
          'JR Pass recommended',
          'Bow when greeting',
          'Remove shoes in homes/shrines',
          'Cash still common',
          'Download Google Translate (camera)'
        ]
      };
    });
  }

  /* Bangkok / Prague / Singapore / Amsterdam now just call generic builder, so nothing else to change */

  /* ─────────────── generic builder – unlimited days ─────────────── */

  private generateGenericDiverseItinerary(
    city: string,
    startDate: string,
    days: number,
    dailyBudget: number,
    insights: any[]
  ): DaySchedule[] {
    const base = [
      { title: `Historic ${city} Discovery`, theme: 'History & Culture' },
      { title: `${city} Food & Market Adventure`, theme: 'Culinary Experience' },
      { title: `Art & Museums in ${city}`, theme: 'Art & Culture' },
      { title: `Local Life in ${city}`, theme: 'Local Experience' },
      { title: `Nature & Scenic ${city}`, theme: 'Nature & Relaxation' }
    ];

    return Array.from({ length: days }, (_, i) => {
      const tpl = base[i % base.length];
      return {
        day: i + 1,
        date: this.addDays(startDate, i),
        title: tpl.title,
        theme: tpl.theme,
        activities: this.buildGenericActivities(city, tpl.theme),
        dailyBudget: `$${dailyBudget}`,
        neighborhoods: [],
        highlights: [],
        notes: [`Auto‑generated day ${i + 1}`]
      };
    });
  }

  private buildGenericActivities(city: string, theme: string): Activity[] {
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

  /* Bangkok / Prague / Singapore / Amsterdam just map to the generic builder */

  private generateBangkokItinerary(start: string, d: number, b: number) { return this.generateGenericDiverseItinerary('Bangkok', start, d, b, []); }
  private generatePragueItinerary(start: string, d: number, b: number) { return this.generateGenericDiverseItinerary('Prague', start, d, b, []); }
  private generateSingaporeItinerary(start: string, d: number, b: number) { return this.generateGenericDiverseItinerary('Singapore', start, d, b, []); }
  private generateAmsterdamItinerary(start: string, d: number, b: number) { return this.generateGenericDiverseItinerary('Amsterdam', start, d, b, []); }
  private generateSeoulItinerary(start: string, d: number, b: number): DaySchedule[] {
    return this.generateGenericDiverseItinerary('Seoul', start, d, b, []);
  }

}
