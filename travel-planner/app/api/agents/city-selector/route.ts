import { NextRequest, NextResponse } from 'next/server';
import { CitySelector } from '@/lib/agents/city-selector';

export async function POST(request: NextRequest) {
  try {
    const preferences = await request.json();
    const citySelector = new CitySelector();
    
    const analysis = await citySelector.analyze(preferences);
    
    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('City Selector API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze cities' },
      { status: 500 }
    );
  }
}