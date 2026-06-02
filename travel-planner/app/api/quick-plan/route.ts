// quick-plan = synchronous single‑request version of the background job
import { NextRequest, NextResponse } from 'next/server';
import { StateGraph } from '@/lib/state-graph';

// /api/quick-plan?city=Seoul,%20South%20Korea
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city');
  if (!city) {
    return NextResponse.json({ error: 'city param missing' }, { status: 400 });
  }

  // minimal prefs – you could forward the original prefs via other query params
  const prefs = {
    destination: city,
    budget: 'luxury',
    interests: 'Food, shopping, Luxury, culture',
    travelers: '4',
    startDate: '2025-10-01',
    endDate: '2025-10-10'
  };

  const graph = new StateGraph({ recursionLimit: 120, timeout: 240_000, enableTools: true });
  const state = await graph.execute(prefs, 'city-selector');

  return NextResponse.json({
    recommendations : state.data['city-selector']?.alternatives,
    itinerary       : {
      destination : state.data['city-selector']?.selectedCity,
      ...state.data['travel-concierge']      // schedule, budget, etc.
    //   localInsights : state.data['local-expert']?.insights,
    //   schedule : state.data['travel-concierge']?.schedule,
    //   budget : state.data['travel-concierge']?.totalBudget,
    },
    workflow_data   : {
      city_analysis    : state.data['city-selector'],
      local_insights   : state.data['local-expert'],
      travel_logistics : state.data['travel-concierge'],
      tool_results     : state.toolCalls
    }
  });
}
