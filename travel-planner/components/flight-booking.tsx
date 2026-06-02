'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plane, 
  Clock, 
  DollarSign,
  Calendar,
  Users,
  ArrowRight,
  Wifi,
  Coffee,
  Utensils,
  Star,
  ExternalLink,
  Filter,
  SortAsc
} from 'lucide-react';
import { motion } from 'framer-motion';

interface FlightBookingProps {
  origin: string;
  destination: string;
  dates: { start: string; end: string };
  travelers: string;
  budget: string;
}

interface FlightOption {
  id: string;
  airline: string;
  logo: string;
  departure: {
    airport: string;
    time: string;
    date: string;
  };
  arrival: {
    airport: string;
    time: string;
    date: string;
  };
  duration: string;
  stops: string;
  price: number;
  class: string;
  amenities: string[];
  baggage: string;
  bookingUrl: string;
  rating: number;
  aircraft: string;
}

export function FlightBooking({ origin, destination, dates, travelers, budget }: FlightBookingProps) {
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [returnFlights, setReturnFlights] = useState<FlightOption[]>([]);
  const [selectedOutbound, setSelectedOutbound] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'price' | 'duration' | 'rating'>('price');
  const [filterClass, setFilterClass] = useState<'all' | 'economy' | 'business' | 'first'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateFlightOptions();
  }, [origin, destination, dates, travelers, budget]);

  const generateFlightOptions = () => {
    setLoading(true);
    
    // Simulate API call delay
    setTimeout(() => {
      const outboundFlights = generateFlights(origin, destination, dates.start, 'outbound');
      const returnFlights = generateFlights(destination, origin, dates.end, 'return');
      
      setFlights(outboundFlights);
      setReturnFlights(returnFlights);
      setLoading(false);
    }, 1500);
  };

  const generateFlights = (from: string, to: string, date: string, type: 'outbound' | 'return'): FlightOption[] => {
    const airlines = [
      { name: 'Emirates', logo: '🇦🇪', rating: 4.8 },
      { name: 'Singapore Airlines', logo: '🇸🇬', rating: 4.9 },
      { name: 'Qatar Airways', logo: '🇶🇦', rating: 4.7 },
      { name: 'Lufthansa', logo: '🇩🇪', rating: 4.5 },
      { name: 'British Airways', logo: '🇬🇧', rating: 4.4 },
      { name: 'Air France', logo: '🇫🇷', rating: 4.3 },
      { name: 'KLM', logo: '🇳🇱', rating: 4.4 },
      { name: 'Turkish Airlines', logo: '🇹🇷', rating: 4.2 }
    ];

    const classes = ['Economy', 'Premium Economy', 'Business', 'First'];
    const aircraft = ['Boeing 777', 'Airbus A350', 'Boeing 787', 'Airbus A380'];
    
    const budgetMultiplier = budget === 'budget' ? 0.7 : budget === 'luxury' ? 1.8 : 1.2;
    const basePrice = 800 * budgetMultiplier;

    return airlines.slice(0, 6).map((airline, index) => {
      const flightClass = index < 2 ? 'Economy' : index < 4 ? 'Premium Economy' : index < 5 ? 'Business' : 'First';
      const classMultiplier = flightClass === 'Economy' ? 1 : 
                             flightClass === 'Premium Economy' ? 1.5 : 
                             flightClass === 'Business' ? 2.5 : 4;
      
      const price = Math.round(basePrice * classMultiplier * (0.8 + Math.random() * 0.4));
      const duration = `${8 + Math.floor(Math.random() * 6)}h ${Math.floor(Math.random() * 60)}m`;
      const stops = Math.random() > 0.6 ? '1 stop' : 'Non-stop';
      
      return {
        id: `${type}-${index}`,
        airline: airline.name,
        logo: airline.logo,
        departure: {
          airport: getAirportCode(from),
          time: `${6 + Math.floor(Math.random() * 12)}:${Math.floor(Math.random() * 6)}0`,
          date: date
        },
        arrival: {
          airport: getAirportCode(to),
          time: `${8 + Math.floor(Math.random() * 16)}:${Math.floor(Math.random() * 6)}0`,
          date: date
        },
        duration,
        stops,
        price,
        class: flightClass,
        amenities: getAmenities(flightClass),
        baggage: flightClass === 'Economy' ? '1 checked bag' : '2 checked bags',
        bookingUrl: 'https://booking.com',
        rating: airline.rating,
        aircraft: aircraft[Math.floor(Math.random() * aircraft.length)]
      };
    });
  };

  const getAirportCode = (location: string): string => {
    const codes: Record<string, string> = {
      'new york': 'JFK',
      'london': 'LHR',
      'paris': 'CDG',
      'tokyo': 'NRT',
      'sydney': 'SYD',
      'dubai': 'DXB',
      'singapore': 'SIN',
      'bangkok': 'BKK',
      'barcelona': 'BCN',
      'amsterdam': 'AMS',
      'rome': 'FCO',
      'madrid': 'MAD',
      'berlin': 'BER',
      'prague': 'PRG'
    };
    
    const key = location.toLowerCase();
    for (const [city, code] of Object.entries(codes)) {
      if (key.includes(city)) return code;
    }
    return 'INT';
  };

  const getAmenities = (flightClass: string): string[] => {
    const baseAmenities = ['In-flight entertainment', 'Meal service'];
    
    if (flightClass === 'Economy') {
      return [...baseAmenities, 'USB charging'];
    } else if (flightClass === 'Premium Economy') {
      return [...baseAmenities, 'Extra legroom', 'Priority boarding', 'USB & AC power'];
    } else if (flightClass === 'Business') {
      return [...baseAmenities, 'Lie-flat seats', 'Lounge access', 'Premium dining', 'Wi-Fi'];
    } else {
      return [...baseAmenities, 'Private suites', 'Shower spa', 'Chauffeur service', 'Michelin dining'];
    }
  };

  const sortFlights = (flights: FlightOption[]) => {
    return [...flights].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.price - b.price;
        case 'duration':
          return parseInt(a.duration) - parseInt(b.duration);
        case 'rating':
          return b.rating - a.rating;
        default:
          return 0;
      }
    });
  };

  const filterFlights = (flights: FlightOption[]) => {
    if (filterClass === 'all') return flights;
    return flights.filter(flight => 
      flight.class.toLowerCase().includes(filterClass === 'business' ? 'business' : filterClass)
    );
  };

  const getFilteredAndSortedFlights = (flights: FlightOption[]) => {
    return sortFlights(filterFlights(flights));
  };

  const getTotalPrice = () => {
    const outbound = flights.find(f => f.id === selectedOutbound);
    const returnFlight = returnFlights.find(f => f.id === selectedReturn);
    return (outbound?.price || 0) + (returnFlight?.price || 0);
  };

  const getAmenityIcon = (amenity: string) => {
    if (amenity.includes('Wi-Fi')) return <Wifi className="w-3 h-3" />;
    if (amenity.includes('Meal') || amenity.includes('dining')) return <Utensils className="w-3 h-3" />;
    if (amenity.includes('Lounge')) return <Coffee className="w-3 h-3" />;
    return <Star className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-blue-600" />
            Searching Flights...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Finding the best flights for your journey</p>
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
          <Plane className="w-5 h-5 text-blue-600" />
          Flight Booking
        </CardTitle>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{origin} → {destination}</span>
          <span>•</span>
          <span>{dates.start} - {dates.end}</span>
          <span>•</span>
          <span>{travelers} travelers</span>
        </div>
        
        {/* Filters and Sorting */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <Select value={filterClass} onValueChange={(value: any) => setFilterClass(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="economy">Economy</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="first">First Class</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <SortAsc className="w-4 h-4" />
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="outbound" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="outbound" className="flex items-center gap-2">
              <Plane className="w-4 h-4" />
              Outbound Flights
              {selectedOutbound && <Badge variant="secondary">Selected</Badge>}
            </TabsTrigger>
            <TabsTrigger value="return" className="flex items-center gap-2">
              <Plane className="w-4 h-4 rotate-180" />
              Return Flights
              {selectedReturn && <Badge variant="secondary">Selected</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="outbound" className="mt-6">
            <div className="space-y-4">
              {getFilteredAndSortedFlights(flights).map((flight, index) => (
                <motion.div
                  key={flight.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedOutbound === flight.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`} onClick={() => setSelectedOutbound(flight.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{flight.logo}</span>
                          <div>
                            <h4 className="font-semibold">{flight.airline}</h4>
                            <p className="text-sm text-gray-600">{flight.aircraft}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">${flight.price}</p>
                          <Badge variant="outline">{flight.class}</Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold">{flight.departure.time}</p>
                          <p className="text-sm text-gray-600">{flight.departure.airport}</p>
                          <p className="text-xs text-gray-500">{flight.departure.date}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <div className="w-8 h-0.5 bg-gray-300"></div>
                            <Plane className="w-4 h-4 text-gray-400" />
                            <div className="w-8 h-0.5 bg-gray-300"></div>
                          </div>
                          <p className="text-sm font-medium">{flight.duration}</p>
                          <p className="text-xs text-gray-500">{flight.stops}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{flight.arrival.time}</p>
                          <p className="text-sm text-gray-600">{flight.arrival.airport}</p>
                          <p className="text-xs text-gray-500">{flight.arrival.date}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {flight.amenities.slice(0, 3).map((amenity, i) => (
                            <Badge key={i} variant="secondary" className="text-xs flex items-center gap-1">
                              {getAmenityIcon(amenity)}
                              {amenity}
                            </Badge>
                          ))}
                          {flight.amenities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{flight.amenities.length - 3} more
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-sm">{flight.rating}</span>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer">
                              Book
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="return" className="mt-6">
            <div className="space-y-4">
              {getFilteredAndSortedFlights(returnFlights).map((flight, index) => (
                <motion.div
                  key={flight.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedReturn === flight.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`} onClick={() => setSelectedReturn(flight.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{flight.logo}</span>
                          <div>
                            <h4 className="font-semibold">{flight.airline}</h4>
                            <p className="text-sm text-gray-600">{flight.aircraft}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">${flight.price}</p>
                          <Badge variant="outline">{flight.class}</Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold">{flight.departure.time}</p>
                          <p className="text-sm text-gray-600">{flight.departure.airport}</p>
                          <p className="text-xs text-gray-500">{flight.departure.date}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <div className="w-8 h-0.5 bg-gray-300"></div>
                            <Plane className="w-4 h-4 text-gray-400" />
                            <div className="w-8 h-0.5 bg-gray-300"></div>
                          </div>
                          <p className="text-sm font-medium">{flight.duration}</p>
                          <p className="text-xs text-gray-500">{flight.stops}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold">{flight.arrival.time}</p>
                          <p className="text-sm text-gray-600">{flight.arrival.airport}</p>
                          <p className="text-xs text-gray-500">{flight.arrival.date}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {flight.amenities.slice(0, 3).map((amenity, i) => (
                            <Badge key={i} variant="secondary" className="text-xs flex items-center gap-1">
                              {getAmenityIcon(amenity)}
                              {amenity}
                            </Badge>
                          ))}
                          {flight.amenities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{flight.amenities.length - 3} more
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-sm">{flight.rating}</span>
                          </div>
                          <Button size="sm" variant="outline" asChild>
                            <a href={flight.bookingUrl} target="_blank" rel="noopener noreferrer">
                              Book
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Flight Summary */}
        {(selectedOutbound || selectedReturn) && (
          <Card className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Flight Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedOutbound && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div>
                      <p className="font-medium">Outbound Flight</p>
                      <p className="text-sm text-gray-600">
                        {flights.find(f => f.id === selectedOutbound)?.airline} - {flights.find(f => f.id === selectedOutbound)?.class}
                      </p>
                    </div>
                    <p className="font-bold text-blue-600">
                      ${flights.find(f => f.id === selectedOutbound)?.price}
                    </p>
                  </div>
                )}
                
                {selectedReturn && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div>
                      <p className="font-medium">Return Flight</p>
                      <p className="text-sm text-gray-600">
                        {returnFlights.find(f => f.id === selectedReturn)?.airline} - {returnFlights.find(f => f.id === selectedReturn)?.class}
                      </p>
                    </div>
                    <p className="font-bold text-blue-600">
                      ${returnFlights.find(f => f.id === selectedReturn)?.price}
                    </p>
                  </div>
                )}
                
                {selectedOutbound && selectedReturn && (
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold">Total Flight Cost</p>
                      <p className="text-2xl font-bold text-blue-600">${getTotalPrice()}</p>
                    </div>
                    <Button className="w-full mt-3 bg-blue-600 hover:bg-blue-700">
                      Proceed to Book Flights
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}