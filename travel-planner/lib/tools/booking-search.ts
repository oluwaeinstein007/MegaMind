// lib/tools/booking-search.ts
import { TavilySearchTool } from './tavily-search';

export class BookingSearchTool {
  private tavily = new TavilySearchTool();

  async searchHotels(city: string) {
    return this.tavily.search(`${city} best hotels city centre 2024 rating`, { max_results: 5 });
  }
  async searchRestaurants(city: string, cuisine: string = '') {
    return this.tavily.search(`${city} top ${cuisine} restaurants Michelin 2024`, { max_results: 5 });
  }
  async searchActivities(city: string) {
    return this.tavily.search(`${city} must do activities 2024`, { max_results: 6 });
  }
}
