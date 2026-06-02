import { NextRequest, NextResponse } from 'next/server';
import { LocalExpert } from '@/lib/agents/local-expert';

export async function POST(request: NextRequest) {
  try {
    const { city, interests } = await request.json();
    const localExpert = new LocalExpert();
    
    const analysis = await localExpert.analyze(city, interests);
    
    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Local Expert API error:', error);
    return NextResponse.json(
      { error: 'Failed to get local insights' },
      { status: 500 }
    );
  }
}