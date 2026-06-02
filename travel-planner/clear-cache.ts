// Utility script to clear Redis cache for debugging
// Run with: bun run clear-cache.ts

import { CacheManager, CACHE_KEYS, CacheKeyHelpers } from './lib/redis';

async function clearCache() {
  try {
    // Clear old generic cache
    const oldPlanKey = CACHE_KEYS.TRAVEL_PLAN('current');
    await CacheManager.del(oldPlanKey);
    console.log('✅ Cache cleared for travel_plan:current');
    
    // Example: Clear cache for specific destination
    // Uncomment and modify for specific locations:
    
    // Clear Seoul cache
    const seoulKey = CACHE_KEYS.TRAVEL_PLAN_BY_LOCATION('Seoul, South Korea', 'Nigeria', '2025-07-31', '2025-08-08');
    await CacheManager.del(seoulKey);
    console.log(`✅ Cache cleared for ${seoulKey}`);
    
    // Clear all keys starting with travel_plan: (use with caution!)
    // const redis = (await import('./lib/redis')).redis;
    // const keys = await redis.keys('travel_plan:*');
    // if (keys.length > 0) {
    //   await redis.del(...keys);
    //   console.log(`✅ Cleared ${keys.length} travel plan cache entries`);
    // }
    
    console.log('🚀 Cache clearing complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
    process.exit(1);
  }
}

clearCache();
