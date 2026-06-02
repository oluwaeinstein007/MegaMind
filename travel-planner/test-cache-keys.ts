// Test script to verify the new cache key generation
// Run with: bun run test-cache-keys.ts

import { CACHE_KEYS, CacheKeyHelpers } from './lib/redis';

function testCacheKeys() {
  console.log('🧪 Testing Cache Key Generation');
  console.log('═'.repeat(50));

  // Test 1: Seoul trip from Nigeria
  const seoulPreferences = {
    destination: 'Seoul, South Korea',
    comingFrom: 'Nigeria',
    startDate: '2025-07-31',
    endDate: '2025-08-08',
    budget: 'luxury',
    travelers: 'solo'
  };

  const seoulKey = CacheKeyHelpers.generateTravelPlanKey(seoulPreferences);
  console.log('🇰🇷 Seoul Key:', seoulKey);

  // Test 2: Tokyo trip with flexible dates
  const tokyoPreferences = {
    destination: 'Tokyo, Japan',
    comingFrom: 'United States',
    startDate: '2025-09-15',
    endDate: '2025-09-25',
    budget: 'mid-range',
    travelers: 'couple'
  };

  const tokyoKey = CacheKeyHelpers.generateTravelPlanKey(tokyoPreferences);
  console.log('🇯🇵 Tokyo Key:', tokyoKey);

  // Test 3: Paris trip without origin
  const parisPreferences = {
    destination: 'Paris, France',
    startDate: '2025-12-20',
    endDate: '2025-12-30',
    budget: 'budget',
    travelers: 'family'
  };

  const parisKey = CacheKeyHelpers.generateTravelPlanKey(parisPreferences);
  console.log('🇫🇷 Paris Key:', parisKey);

  // Test 4: Chat key generation
  const chatKey = CacheKeyHelpers.generateChatKey(seoulPreferences);
  console.log('💬 Seoul Chat Key:', chatKey);

  // Test 5: Key parsing
  console.log('\n📝 Key Parsing Test:');
  const parsedSeoul = CacheKeyHelpers.parseTravelPlanKey(seoulKey);
  console.log('Parsed Seoul Key:', parsedSeoul);

  // Test 6: Direct location-based key
  const directKey = CACHE_KEYS.TRAVEL_PLAN_BY_LOCATION(
    'Barcelona, Spain',
    'New York',
    '2025-08-10',
    '2025-08-20'
  );
  console.log('🇪🇸 Direct Barcelona Key:', directKey);

  console.log('\n✅ Cache key testing complete!');
}

testCacheKeys();
