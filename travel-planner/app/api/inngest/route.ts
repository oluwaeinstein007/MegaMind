// Inngest API route (disabled for now)
// Uncomment when ready to use Inngest

/*
import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest-client';
import { 
  travelPlanningWorkflow, 
  optimizeSearchResults, 
  updateTravelData 
} from '@/lib/inngest-client';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    travelPlanningWorkflow,
    optimizeSearchResults,
    updateTravelData
  ],
});
*/

import { NextRequest, NextResponse } from 'next/server';

// Placeholder endpoints for when Inngest is disabled
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Inngest integration is currently disabled',
    status: 'inactive'
  });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Inngest integration is currently disabled',
    status: 'inactive'
  });
}

export async function PUT(request: NextRequest) {
  return NextResponse.json({ 
    message: 'Inngest integration is currently disabled',
    status: 'inactive'
  });
}