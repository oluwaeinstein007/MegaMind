import { NextRequest, NextResponse } from 'next/server';
import { fetchTopPlaces, fetchFlightOptions } from '@/lib/tools/tavily-wrapper';

export async function POST(req: NextRequest) {
  try {
    let destination, type, budget, dates;
    
    // Try to parse JSON body first, fallback to URL parameters
    try {
      const body = await req.json();
      destination = body.destination;
      type = body.type;
      budget = body.budget;
      dates = body.dates;
    } catch {
      // If JSON parsing fails, use URL search parameters
      const url = new URL(req.url);
      destination = url.searchParams.get('destination');
      type = url.searchParams.get('category') || url.searchParams.get('type');
      budget = url.searchParams.get('budget');
      const dateParam = url.searchParams.get('dates');
      dates = dateParam ? { start: dateParam } : null;
    }

    if (!destination || !type) {
      return NextResponse.json(
        { error: 'Destination and type are required' },
        { status: 400 }
      );
    }

    let results: any[] = [];

    switch (type) {
      case 'hotel':
        console.log(`🏨 Searching for hotels in ${destination}`);
        results = await fetchTopPlaces(destination, 'hotel', 8);
        break;

      case 'restaurant':
        console.log(`🍽️ Searching for restaurants in ${destination}`);
        results = await fetchTopPlaces(destination, 'restaurant', 10);
        break;

      case 'activity':
        console.log(`🎯 Searching for activities in ${destination}`);
        results = await fetchTopPlaces(destination, 'activity', 12);
        break;

      case 'flight':
        console.log(`✈️ Searching for flights to ${destination}`);
        {
          const origin = req.nextUrl.searchParams.get('origin') || 'Your Location';
          const destinationCity = destination.split(',')[0];
          const originCity = origin || 'Your Location';
          const departureDate = dates?.start || '';
          const returnDate = dates?.end || '';

          // Provide real meta-search links (not fabricated prices/itineraries)
          const links = [
            {
              type: 'Meta search',
              provider: 'Skyscanner',
              departure: originCity,
              arrival: destinationCity,
              departureDate,
              returnDate,
              bookingLink: `https://www.skyscanner.com/routes/${originCity.toLowerCase().replace(/\s+/g, '-')}/${destinationCity.toLowerCase().replace(/\s+/g, '-')}`,
              category: 'flight'
            },
            {
              type: 'Meta search',
              provider: 'Kayak',
              departure: originCity,
              arrival: destinationCity,
              departureDate,
              returnDate,
              bookingLink: `https://www.kayak.com/flights/${originCity}-${destinationCity}/${departureDate}${returnDate ? '/' + returnDate : ''}`,
              category: 'flight'
            }
          ];

          // Also include relevant web results about flights for the route.
          const flightQuery = `flights from ${origin} to ${destination} booking skyscanner kayak expedia`;
          const web = await fetchTopPlaces(destination, flightQuery, 5);
          results = [
            ...links,
            ...web.map((r: any) => ({
              type: 'Web result',
              provider: 'Web',
              departure: originCity,
              arrival: destinationCity,
              departureDate,
              returnDate,
              bookingLink: r.link,
              name: r.name,
              blurb: r.blurb,
              category: 'flight'
            }))
          ];
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid booking type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      results,
      data: results,
      destination,
      type,
      count: results.length
    });

  } catch (error) {
    console.error('Booking search error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch booking recommendations',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
