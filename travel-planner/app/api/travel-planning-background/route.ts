import { NextRequest, NextResponse } from 'next/server';
import { createTravelPlanningJob } from '@/lib/background-jobs';
import { CacheManager } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId, preferences } = await request.json();

    if (!userId || !preferences) {
      return NextResponse.json(
        { error: 'Missing userId or preferences' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!preferences.destination || !preferences.budget || !preferences.startDate || 
        !preferences.endDate || !preferences.travelers || !preferences.interests) {
      return NextResponse.json(
        { error: 'Missing required fields in preferences' },
        { status: 400 }
      );
    }

    console.log('🚀 Creating background travel planning job');
    
    // Test Redis connection first
    const redisConnected = await CacheManager.testConnection();
    if (!redisConnected) {
      return NextResponse.json(
        { 
          error: 'Redis connection failed',
          details: 'External Redis instance is not accessible. Please check your Redis configuration.'
        },
        { status: 503 }
      );
    }
    
    // Create background job
    const jobId = await createTravelPlanningJob(userId, preferences);
    
    console.log('✅ Background job created:', jobId);

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Travel planning job started in background',
      redisConnected: true
    });

  } catch (error) {
    console.error('❌ Background job creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create background job',
        details: error instanceof Error ? error.message : 'Unknown error',
        redisConnected: false
      },
      { status: 500 }
    );
  }
}