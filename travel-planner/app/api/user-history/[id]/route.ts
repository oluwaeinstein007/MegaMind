import { NextRequest, NextResponse } from 'next/server';
import { CacheManager } from '@/lib/redis';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const planId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Remove the plan from the user's history list
    await CacheManager.removeFromHistory(userId, planId);

    // Delete the individual plan cache entry
    await CacheManager.del(`travel_plan:${planId}`);

    return NextResponse.json({
      success: true,
      message: 'Travel plan successfully deleted'
    });
  } catch (error) {
    console.error('Delete history item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete travel plan' },
      { status: 500 }
    );
  }
}
