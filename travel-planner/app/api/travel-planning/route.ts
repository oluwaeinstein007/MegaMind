import { NextRequest, NextResponse } from 'next/server';
import { OrchestratorEngine } from '@/lib/orchestrator-engine';

export const dynamic = 'force-dynamic';

/**
 * Multi-Agent Travel Planning Orchestration Engine via Veridex Agent Fabric
 */
export async function POST(request: NextRequest) {
  try {
    const preferences = await request.json();

    // Validate required fields
    if (!preferences.destination || !preferences.budget || !preferences.startDate || 
        !preferences.endDate || !preferences.travelers || !preferences.interests) {
      return NextResponse.json(
        { error: 'Missing required fields. Please provide all travel preferences.' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting Veridex TaskGraph Travel Planning Orchestration');
    console.log('📋 Preferences:', preferences);

    // Initialize the new Orchestrator Engine
    const engine = new OrchestratorEngine();

    // Execute the dependency task graph workflow
    const result = await engine.execute(preferences);

    // Save plan to user history if userId is provided
    if (preferences.userId) {
      try {
        const { CacheManager, CACHE_KEYS, CacheKeyHelpers } = await import('@/lib/redis');
        const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const planKey = CACHE_KEYS.TRAVEL_PLAN(planId);
        
        const normalizedPlan = {
          itinerary: result.itinerary || null,
          recommendations: result.recommendations || [],
          workflow_data: result.workflow_data || {},
          orchestration: result.orchestration || {}
        };
        
        // Cache under both the unique plan ID and the location-based composite key
        await CacheManager.set(planKey, normalizedPlan, 86400);
        
        const locationKey = CacheKeyHelpers.generateTravelPlanKey(preferences);
        await CacheManager.set(locationKey, normalizedPlan, 86400);

        const historyItem = {
          id: planId,
          preferences: {
            destination: preferences.destination,
            comingFrom: preferences.comingFrom,
            budget: preferences.budget,
            startDate: preferences.startDate,
            endDate: preferences.endDate,
            travelers: preferences.travelers,
            interests: preferences.interests,
          },
          result,
          createdAt: Date.now()
        };
        
        await CacheManager.addToList(CACHE_KEYS.USER_HISTORY(preferences.userId), historyItem);
        console.log(`📚 Added plan to history for user ${preferences.userId}`);
      } catch (historyError) {
        console.error('⚠️ Failed to save plan to user history:', historyError);
      }
    }

    console.log('✅ Veridex Orchestration Complete');
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Veridex Orchestration Error:', error);
    return NextResponse.json(
      {
        error: 'Multi-agent orchestration failed',
        details: error instanceof Error ? error.message : 'Unknown orchestration error',
        type: 'orchestration_error'
      },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint for the orchestration engine
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'healthy',
      engine: 'Veridex Native Multi-Agent Travel Planning',
      version: '2.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}