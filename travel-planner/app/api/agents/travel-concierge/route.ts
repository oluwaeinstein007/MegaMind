import { NextRequest, NextResponse } from 'next/server';
import { TravelConcierge } from '@/lib/agents/travel-concierge';

export async function POST(request: NextRequest) {
  try {
    const { city, insights, preferences } = await request.json();
    const travelConcierge = new TravelConcierge();
    
    const itinerary = await travelConcierge.createItinerary(
      city,
      insights,
      preferences.startDate,
      preferences.endDate,
      preferences.travelers,
      preferences.budget
    );
    
    return NextResponse.json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('Travel Concierge API error:', error);
    return NextResponse.json(
      { error: 'Failed to create itinerary' },
      { status: 500 }
    );
  }
}