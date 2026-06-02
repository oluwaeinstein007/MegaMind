'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ExternalLink, 
  Star, 
  MapPin, 
  Clock, 
  DollarSign,
  Bed,
  Utensils,
  Plane,
  Car,
  Calendar,
  Users,
  Wifi,
  Coffee,
  Dumbbell,
  Car as CarIcon,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { FlightBooking } from './flight-booking';
import { toast } from 'sonner';

interface BookingRecommendationsProps {
  destination: string;
  dates: { start: string; end: string };
  travelers: string;
  budget: string;
  origin?: string;
  refreshKey?: number; // increment to force refresh after chat modifications
}

interface BookingItem {
  name: string;
  link: string;
  blurb: string;
  category: string;
  city: string;
  rating?: number;
  price?: string;
  [key: string]: any;
}

export function BookingRecommendations({ destination, dates, travelers, budget, origin = 'Your Location', refreshKey = 0 }: BookingRecommendationsProps) {
  const [activeTab, setActiveTab] = useState('flights');
  const [bookingData, setBookingData] = useState<{
    hotels: BookingItem[];
    restaurants: BookingItem[];
    activities: BookingItem[];
    flights: any[];
    loading: boolean;
  }>({
    hotels: [],
    restaurants: [],
    activities: [],
    flights: [],
    loading: true
  });

  useEffect(() => {
    if (destination) {
      fetchBookingData();
    }
  }, [destination, dates, budget, refreshKey]);

  const fetchBookingData = async () => {
    setBookingData(prev => ({ ...prev, loading: true }));
    
    try {
      // Make separate, specific searches for each category
      const [hotelsResponse, restaurantsResponse, activitiesResponse, flightsResponse] = await Promise.allSettled([
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            type: 'hotel',
            budget,
            dates
          })
        }),
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            type: 'restaurant',
            budget,
            dates
          })
        }),
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            type: 'activity',
            budget,
            dates
          })
        }),
        fetch(`/api/booking-search?origin=${encodeURIComponent(origin)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            destination,
            type: 'flight',
            budget,
            dates,
            origin
          })
        })
      ]);

      const hotels = hotelsResponse.status === 'fulfilled' && hotelsResponse.value.ok 
        ? await hotelsResponse.value.json() 
        : { results: [] };
      
      const restaurants = restaurantsResponse.status === 'fulfilled' && restaurantsResponse.value.ok 
        ? await restaurantsResponse.value.json() 
        : { results: [] };
      
      const activities = activitiesResponse.status === 'fulfilled' && activitiesResponse.value.ok 
        ? await activitiesResponse.value.json() 
        : { results: [] };

      const flights = flightsResponse.status === 'fulfilled' && flightsResponse.value.ok 
        ? await flightsResponse.value.json() 
        : { results: [] };

      // Fallback to generated flight options if API fails
      const flightOptions = flights.results?.length > 0 
        ? flights.results 
        : generateFlightOptions(origin, destination, dates);

      setBookingData({
        hotels: hotels.results || [],
        restaurants: restaurants.results || [],
        activities: activities.results || [],
        flights: flightOptions,
        loading: false
      });

    } catch (error) {
      console.error('Error fetching booking data:', error);
      setBookingData(prev => ({ ...prev, loading: false }));
      toast.error('Failed to load booking recommendations');
    }
  };

  const generateFlightOptions = (origin: string, destination: string, dates: { start: string; end: string }) => {
    const destinationCity = destination.split(',')[0];
    const originCity = origin || 'Your Location';
    
    return [
      {
        type: 'Round-trip',
        departure: originCity,
        arrival: destinationCity,
        departureDate: dates.start,
        returnDate: dates.end,
        bookingLink: `https://www.skyscanner.com/routes/${originCity.toLowerCase().replace(/\s+/g, '-')}/${destinationCity.toLowerCase().replace(/\s+/g, '-')}`,
        estimatedPrice: getBudgetRange(budget, 'flight'),
        provider: 'Skyscanner'
      },
      {
        type: 'Alternative',
        departure: originCity,
        arrival: destinationCity,
        departureDate: dates.start,
        returnDate: dates.end,
        bookingLink: `https://www.kayak.com/flights/${originCity}-${destinationCity}/${dates.start}${dates.end ? '/' + dates.end : ''}`,
        estimatedPrice: getBudgetRange(budget, 'flight'),
        provider: 'Kayak'
      }
    ];
  };

  const getBudgetRange = (budget: string, type: string) => {
    const ranges = {
      budget: { hotel: '$50-80/night', restaurant: '$15-25/meal', flight: '$300-500', activity: '$15-35' },
      mid: { hotel: '$80-150/night', restaurant: '$25-50/meal', flight: '$500-800', activity: '$35-65' },
      luxury: { hotel: '$150-300/night', restaurant: '$50-100/meal', flight: '$800-1500+', activity: '$65-150+' }
    };
    return ranges[budget as keyof typeof ranges]?.[type as keyof typeof ranges.budget] || 'Price varies';
  };

  const getAmenityIcon = (amenity: string) => {
    const iconMap: Record<string, any> = {
      'Free WiFi': Wifi,
      'Wifi': Wifi,
      'Spa': Star,
      'Gym': Dumbbell,
      'Restaurant': Utensils,
      'Pool': Star,
      'Breakfast': Coffee,
      'Parking': CarIcon
    };
    const IconComponent = iconMap[amenity] || Star;
    return <IconComponent className="w-3 h-3" />;
  };

  if (bookingData.loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-blue-600 animate-pulse" />
            Loading Booking Options...
          </CardTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Searching for the best options in {destination}
          </p>
        </CardHeader>
        <CardContent className="py-8">
          <div className="space-y-6">
            {/* Skeleton tabs */}
            <div className="flex gap-2 border-b pb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              ))}
            </div>
            {/* Skeleton cards */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-64 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                  <div className="h-8 w-24 bg-blue-100 dark:bg-blue-900/50 rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-5 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
            {/* Loading indicator */}
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Fetching live booking data...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-blue-600" />
          Booking Options for {destination}
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Real booking links and recommendations for your trip
        </p>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="flights" className="flex items-center gap-1">
              <Plane className="w-4 h-4" />
              <span className="hidden sm:inline">Flights</span>
            </TabsTrigger>
            <TabsTrigger value="hotels" className="flex items-center gap-1">
              <Bed className="w-4 h-4" />
              <span className="hidden sm:inline">Hotels</span>
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="flex items-center gap-1">
              <Utensils className="w-4 h-4" />
              <span className="hidden sm:inline">Dining</span>
            </TabsTrigger>
            <TabsTrigger value="activities" className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Activities</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flights" className="mt-4">
            <div className="space-y-4">
              {bookingData.flights.map((flight, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-lg">{flight.type} Flight</h4>
                          <p className="text-sm text-gray-600">{flight.departure} → {flight.arrival}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span>📅 {flight.departureDate}</span>
                            {flight.returnDate && <span>↩️ {flight.returnDate}</span>}
                          </div>
                        </div>
                        <Badge variant="outline">{flight.provider}</Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          {flight.estimatedPrice ? (
                            <>
                              <p className="font-semibold text-blue-600">{flight.estimatedPrice}</p>
                              <p className="text-xs text-gray-500">Estimated price range</p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-blue-600">Compare live prices</p>
                              <p className="text-xs text-gray-500">Opens a real search</p>
                            </>
                          )}
                        </div>
                        <Button asChild>
                          <a href={flight.bookingLink} target="_blank" rel="noopener noreferrer">
                            Search Flights
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hotels" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookingData.hotels.map((hotel, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    {hotel.image && (
                      <div className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden">
                        <img 
                          src={hotel.image} 
                          alt={hotel.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-sm">{hotel.name}</h4>
                        {hotel.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-xs">{hotel.rating}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-xs text-gray-600">{hotel.location || destination}</span>
                      </div>
                      
                      <p className="text-xs text-gray-600 mb-3">{hotel.blurb}</p>
                      
                      {hotel.amenities && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {hotel.amenities.slice(0, 3).map((amenity: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs flex items-center gap-1">
                              {getAmenityIcon(amenity)}
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <div>
                          {hotel.price && <p className="font-semibold text-blue-600">{hotel.price}</p>}
                          {hotel.availability && <p className="text-xs text-green-600">{hotel.availability}</p>}
                        </div>
                        <Button size="sm" asChild>
                          <a href={hotel.link} target="_blank" rel="noopener noreferrer">
                            Book Now
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="restaurants" className="mt-4">
            <div className="space-y-4">
              {bookingData.restaurants.map((restaurant, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{restaurant.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {restaurant.cuisine && <Badge variant="outline">{restaurant.cuisine}</Badge>}
                            {restaurant.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                <span className="text-sm">{restaurant.rating}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {restaurant.price && (
                            <p className="font-semibold text-blue-600">{restaurant.price}</p>
                          )}
                          {restaurant.bookingAdvance && (
                            <p className="text-xs text-gray-600">{restaurant.bookingAdvance}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-600">{restaurant.location || destination}</span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{restaurant.blurb}</p>
                      
                      {restaurant.specialties && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {restaurant.specialties.map((specialty: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      <Button size="sm" asChild>
                        <a href={restaurant.link} target="_blank" rel="noopener noreferrer">
                          Make Reservation
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="activities" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookingData.activities.map((activity, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{activity.name}</h4>
                        {activity.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-sm">{activity.rating}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-3 text-sm">
                        {activity.price && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-gray-500" />
                            <span>{activity.price}</span>
                          </div>
                        )}
                        {activity.duration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span>{activity.duration}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{activity.blurb}</p>
                      
                      {activity.includes && (
                        <div className="space-y-1 mb-3">
                          <p className="text-xs font-medium text-gray-700">Includes:</p>
                          {activity.includes.map((item: string, i: number) => (
                            <p key={i} className="text-xs text-gray-600">• {item}</p>
                          ))}
                        </div>
                      )}
                      
                      <Button size="sm" asChild>
                        <a href={activity.link} target="_blank" rel="noopener noreferrer">
                          Book Activity
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}