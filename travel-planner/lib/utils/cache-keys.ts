/**
 * Cache key generation utilities that can be safely used on both client and server side.
 * These utilities do not import any Node.js-specific dependencies.
 */

/**
 * Clean a string for use in cache keys - removes special characters and normalizes
 */
function cleanString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')       // Remove leading/trailing underscores
    .slice(0, 50);                 // Limit length
}

// Cache keys for various data types to ensure consistent key naming.
export const CACHE_KEYS = {
  TRAVEL_PLAN: (id: string) => `travel_plan:${id}`,
  TRAVEL_PLAN_BY_LOCATION: (destination: string, origin?: string, startDate?: string, endDate?: string) => {
    // Create a unique key based on travel parameters
    const cleanDestination = cleanString(destination);
    const cleanOrigin = origin ? cleanString(origin) : 'anywhere';
    
    const dateRange = startDate && endDate ? `${startDate}_to_${endDate}` : 'flexible_dates';
    
    return `travel_plan:${cleanDestination}:from_${cleanOrigin}:${dateRange}`;
  },
  USER_HISTORY: (userId: string) => `user_history:${userId}`,
  BACKGROUND_JOB: (jobId: string) => `job:${jobId}`,
  CHAT_HISTORY: (planId: string) => `chat:${planId}`,
};

/**
 * Helper functions for generating cache keys
 */
export const CacheKeyHelpers = {
  /**
   * Generate a travel plan cache key from preferences
   */
  generateTravelPlanKey: (preferences: {
    destination: string;
    comingFrom?: string;
    startDate?: string;
    endDate?: string;
    budget?: string;
    travelers?: string;
  }) => {
    const { destination, comingFrom, startDate, endDate, budget, travelers } = preferences;
    
    // Create base key from location and dates
    let baseKey = CACHE_KEYS.TRAVEL_PLAN_BY_LOCATION(destination, comingFrom, startDate, endDate);
    
    // Add budget and travelers as suffixes for more specific caching
    if (budget) {
      baseKey += `:${budget.toLowerCase()}`;
    }
    if (travelers) {
      const travelerCount = travelers.toLowerCase().replace(/\s+/g, '_');
      baseKey += `:${travelerCount}`;
    }
    
    return baseKey;
  },

  /**
   * Generate a chat history key from travel plan preferences
   */
  generateChatKey: (preferences: {
    destination: string;
    comingFrom?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const planKey = CACHE_KEYS.TRAVEL_PLAN_BY_LOCATION(
      preferences.destination,
      preferences.comingFrom,
      preferences.startDate,
      preferences.endDate
    );
    return `chat:${planKey.replace('travel_plan:', '')}`;
  },

  /**
   * Parse a travel plan key to extract location information
   */
  parseTravelPlanKey: (key: string) => {
    const parts = key.replace('travel_plan:', '').split(':');
    return {
      destination: parts[0]?.replace(/_/g, ' ') || '',
      origin: parts[1]?.replace('from_', '').replace(/_/g, ' ') || '',
      dateRange: parts[2] || '',
      budget: parts[3] || '',
      travelers: parts[4] || ''
    };
  }
};
