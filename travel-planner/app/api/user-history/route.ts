import { NextRequest, NextResponse } from 'next/server';
import { getUserHistory } from '@/lib/background-jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const history = await getUserHistory(userId);
    
    return NextResponse.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('User history error:', error);
    return NextResponse.json(
      { error: 'Failed to get user history' },
      { status: 500 }
    );
  }
}