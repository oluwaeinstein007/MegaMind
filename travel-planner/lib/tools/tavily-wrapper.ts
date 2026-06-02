// lib/tools/tavily-wrapper.ts
import { TavilySearchTool } from './tavily-search'

export const fetchTopPlaces = async (
  city: string,
  kind: 'hotel' | 'restaurant' | 'activity' | string,
  max = 5
) => {
  const tool = new TavilySearchTool()
  
  let query: string
  
  // If kind is a predefined type, use enhanced queries
  if (kind === 'hotel' || kind === 'restaurant' || kind === 'activity') {
    const queries = {
      hotel: `"${city}" hotels "book hotel" "hotel booking" site:booking.com OR site:agoda.com OR site:hotels.com OR site:expedia.com`,
      restaurant: `"${city}" restaurants "restaurant reviews" "where to eat" site:tripadvisor.com OR site:yelp.com OR site:zomato.com`,
      activity: `"${city}" attractions "things to do" "tourist attractions" site:tripadvisor.com OR site:viator.com OR site:getyourguide.com`
    }
    query = queries[kind]
  } else {
    // If kind is a custom query string, use it directly
    query = kind
  }
  const { results } = await tool.search(query, { max_results: max })
  
  return results.map(({ title, url, content }) => {
    // Extract useful information and create proper booking links
    let name = title.replace(/^\d+\.\s*/, '').replace(/\s*-.*$/, '').trim()
    
    // Clean up the name to remove common prefixes/suffixes
    name = name
      .replace(/^(Best|Top|#\d+)\s+/i, '')
      .replace(/\s+(in|at|near)\s+.*/i, '')
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*•.*$/, '')
      .trim()
    
    // Extract location information from content
    let location = city
    const locationMatch = content.match(new RegExp(`(${city}[^.]*?)(?:\\.|,|\\n)`, 'i'))
    if (locationMatch) {
      location = locationMatch[1].trim()
    }
    
    // Extract description/blurb from content
    let blurb = content.substring(0, 150).replace(/\n/g, ' ').trim()
    if (blurb.length > 147) {
      blurb = blurb.substring(0, 147) + '...'
    }
    
    // Determine the actual type from the query for booking URLs
    let actualType = 'activity' // default
    if (query.includes('hotel') || query.includes('accommodation') || query.includes('stay')) {
      actualType = 'hotel'
    } else if (query.includes('restaurant') || query.includes('dining') || query.includes('food') || query.includes('eat')) {
      actualType = 'restaurant'
    } else if (query.includes('flight') || query.includes('airline')) {
      actualType = 'flight'
    }
    
    // Create booking-friendly URLs based on the type
    let bookingUrl = url
    if (actualType === 'hotel') {
      if (url.includes('booking.com') || url.includes('agoda.com') || url.includes('expedia.com')) {
        bookingUrl = url
      } else {
        // Generate booking.com search URL
        const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(city)}&dest_type=city`
      }
    } else if (actualType === 'restaurant') {
      if (url.includes('opentable.com') || url.includes('resy.com')) {
        bookingUrl = url
      } else {
        // Generate OpenTable search URL
        bookingUrl = `https://www.opentable.com/s?query=${encodeURIComponent(city)}`
      }
    } else if (actualType === 'activity') {
      if (url.includes('viator.com') || url.includes('getyourguide.com') || url.includes('klook.com')) {
        bookingUrl = url
      } else {
        // Generate GetYourGuide search URL
        const citySlug = city.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        bookingUrl = `https://www.getyourguide.com/s/?q=${encodeURIComponent(city)}`
      }
    }
    
    // Use the blurb extracted above, or create a fallback
    const finalBlurb = blurb || content
      .replace(/\d{4}-\d{2}-\d{2}.*?-/, '') // Remove dates
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .slice(0, 180)
      .trim()
    
    return {
      name,
      link: bookingUrl,
      blurb: finalBlurb || `Top-rated ${actualType} in ${city}. Click to view details and book.`,
      category: actualType,
      city,
      location
    }
  })
}

// New function for flight booking information
export const fetchFlightOptions = async (
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string
) => {
  const tool = new TavilySearchTool()
  const query = `flights ${origin} to ${destination} ${departureDate} booking skyscanner kayak expedia`
  const { results } = await tool.search(query, { max_results: 3 })
  
  const destinationCity = destination.split(',')[0] // Extract city name
  const originCity = origin || 'Your Location'
  
  return [
    {
      type: 'Round-trip' as const,
      departure: originCity,
      arrival: destinationCity,
      departureDate: departureDate,
      returnDate: returnDate || '',
      bookingLink: `https://www.skyscanner.com/routes/${originCity.toLowerCase().replace(/\s+/g, '-')}/${destinationCity.toLowerCase().replace(/\s+/g, '-')}`,
      notes: 'Compare prices across multiple airlines and booking sites',
      estimatedPrice: 'Price varies by season and booking time',
      tips: [
        'Book 6-8 weeks in advance for best prices',
        'Use incognito mode when searching',
        'Consider nearby airports for better deals'
      ]
    },
    {
      type: 'Alternative Route' as const,
      departure: originCity,
      arrival: destinationCity,
      departureDate: departureDate,
      returnDate: returnDate || '',
      bookingLink: `https://www.kayak.com/flights/${originCity}-${destinationCity}/${departureDate}${returnDate ? '/' + returnDate : ''}`,
      notes: 'Check for connecting flights that might be cheaper',
      estimatedPrice: 'Often 20-40% less than direct flights',
      tips: [
        'Consider longer layovers for lower prices',
        'Check if separate tickets are cheaper',
        'Look into budget airlines'
      ]
    }
  ]
}
