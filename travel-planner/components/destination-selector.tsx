'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Star, 
  DollarSign, 
  Calendar, 
  Users,
  Search,
  Filter,
  TrendingUp,
  Heart,
  Eye,
  Plane
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Destination {
  id: string;
  city: string;
  country: string;
  region: string;
  rating: number;
  highlights: string[];
  budget: string;
  bestFor: string[];
  reasoning: string;
  image: string;
  flightTime: string;
  visaRequired: boolean;
  bestSeason: string;
  temperature: string;
  currency: string;
  language: string;
  timeZone: string;
  trending: boolean;
  localTip: string;
}

interface DestinationSelectorProps {
  preferences: {
    destination: string;
    comingFrom: string;
    budget: string;
    interests: string;
    travelers: string;
    startDate: string;
    endDate: string;
  };
  onDestinationSelect: (destination: Destination) => void;
  selectedDestination?: Destination;
}

export function DestinationSelector({ preferences, onDestinationSelect, selectedDestination }: DestinationSelectorProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [filteredDestinations, setFilteredDestinations] = useState<Destination[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateDestinations();
  }, [preferences]);

  useEffect(() => {
    filterDestinations();
  }, [destinations, searchQuery, filterRegion]);

  const generateDestinations = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const generatedDestinations = createDestinationsBasedOnPreferences();
      setDestinations(generatedDestinations);
      setLoading(false);
    }, 1000);
  };

  const createDestinationsBasedOnPreferences = (): Destination[] => {
    const { destination, budget, interests, comingFrom } = preferences;
    const budgetMultiplier = budget === 'budget' ? 0.7 : budget === 'luxury' ? 1.8 : 1.2;
    
    // Base destinations with dynamic data
    const baseDestinations: Partial<Destination>[] = [
      {
        city: 'Barcelona',
        country: 'Spain',
        region: 'Europe',
        highlights: ['Sagrada Familia', 'Park Güell', 'Gothic Quarter', 'Beach Access', 'Tapas Culture'],
        bestFor: ['Architecture', 'Culture', 'Food', 'Beach'],
        reasoning: 'Perfect blend of culture, architecture, and Mediterranean lifestyle with excellent value.',
        image: 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'April-June, September-October',
        currency: 'EUR',
        language: 'Spanish, Catalan',
        trending: true,
        localTip: 'Visit Park Güell early morning to avoid crowds and get the best photos'
      },
      {
        city: 'Tokyo',
        country: 'Japan',
        region: 'Asia',
        highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tsukiji Market', 'Mount Fuji', 'Robot Restaurant'],
        bestFor: ['Technology', 'Culture', 'Food', 'Shopping'],
        reasoning: 'Incredible blend of traditional culture and cutting-edge technology with amazing food scene.',
        image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'March-May, September-November',
        currency: 'JPY',
        language: 'Japanese',
        trending: true,
        localTip: 'Get a JR Pass for unlimited train travel and try convenience store food'
      },
      {
        city: 'Bangkok',
        country: 'Thailand',
        region: 'Asia',
        highlights: ['Grand Palace', 'Floating Markets', 'Street Food', 'Temples', 'Chatuchak Market'],
        bestFor: ['Culture', 'Food', 'Budget Travel', 'Temples'],
        reasoning: 'Incredible value with rich culture, amazing street food, and beautiful temples.',
        image: 'https://images.pexels.com/photos/1007426/pexels-photo-1007426.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'November-March',
        currency: 'THB',
        language: 'Thai',
        trending: false,
        localTip: 'Use the BTS Skytrain to avoid traffic and try street food from busy stalls'
      },
      {
        city: 'Prague',
        country: 'Czech Republic',
        region: 'Europe',
        highlights: ['Prague Castle', 'Charles Bridge', 'Old Town Square', 'Beer Culture', 'Astronomical Clock'],
        bestFor: ['Architecture', 'History', 'Budget Travel', 'Beer'],
        reasoning: 'Stunning medieval architecture with very affordable prices and rich cultural experiences.',
        image: 'https://images.pexels.com/photos/1845331/pexels-photo-1845331.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'April-June, September-October',
        currency: 'CZK',
        language: 'Czech',
        trending: false,
        localTip: 'Visit Prague Castle early morning and try traditional goulash with Czech beer'
      },
      {
        city: 'Singapore',
        country: 'Singapore',
        region: 'Asia',
        highlights: ['Gardens by the Bay', 'Marina Bay Sands', 'Hawker Centers', 'Sentosa Island', 'Chinatown'],
        bestFor: ['Modern Architecture', 'Food', 'Shopping', 'Safety'],
        reasoning: 'Perfect blend of cultures with excellent infrastructure and diverse food scene.',
        image: 'https://images.pexels.com/photos/2265876/pexels-photo-2265876.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'February-April',
        currency: 'SGD',
        language: 'English, Mandarin, Malay, Tamil',
        trending: true,
        localTip: 'Eat at hawker centers for authentic local food at great prices'
      },
      {
        city: 'Amsterdam',
        country: 'Netherlands',
        region: 'Europe',
        highlights: ['Canal Tours', 'Van Gogh Museum', 'Vondelpark', 'Bike Culture', 'Red Light District'],
        bestFor: ['Art', 'Canals', 'Cycling', 'Museums'],
        reasoning: 'Unique canal city with world-class museums and bike-friendly culture.',
        image: 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=400',
        visaRequired: false,
        bestSeason: 'April-September',
        currency: 'EUR',
        language: 'Dutch',
        trending: false,
        localTip: 'Rent a bike to explore like a local and book museum tickets in advance'
      }
    ];

    // Calculate flight times and other dynamic data
    return baseDestinations.map((dest, index) => {
      const flightTime = calculateFlightTime(comingFrom, dest.city!);
      const temperature = getCurrentTemperature(dest.city!);
      const timeZone = getTimeZone(dest.city!);
      const rating = 4.2 + (Math.random() * 0.7);
      const budgetRange = calculateBudgetRange(budgetMultiplier);

      return {
        id: `dest-${index}`,
        ...dest,
        rating: Math.round(rating * 10) / 10,
        budget: budgetRange,
        flightTime,
        temperature,
        timeZone
      } as Destination;
    });
  };

  const calculateFlightTime = (from: string, to: string): string => {
    // Simplified flight time calculation
    const distances: Record<string, Record<string, number>> = {
      'new york': { 'barcelona': 7.5, 'tokyo': 14, 'bangkok': 17, 'prague': 8, 'singapore': 18, 'amsterdam': 7 },
      'london': { 'barcelona': 2, 'tokyo': 11, 'bangkok': 11, 'prague': 2, 'singapore': 13, 'amsterdam': 1 },
      'sydney': { 'barcelona': 22, 'tokyo': 9, 'bangkok': 9, 'prague': 20, 'singapore': 8, 'amsterdam': 22 }
    };
    
    const fromKey = from.toLowerCase();
    const toKey = to.toLowerCase();
    
    const hours = distances[fromKey]?.[toKey] || 8 + Math.random() * 10;
    return `${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m`;
  };

  const getCurrentTemperature = (city: string): string => {
    const temps: Record<string, string> = {
      'barcelona': '22°C',
      'tokyo': '18°C',
      'bangkok': '32°C',
      'prague': '15°C',
      'singapore': '30°C',
      'amsterdam': '16°C'
    };
    return temps[city.toLowerCase()] || '20°C';
  };

  const getTimeZone = (city: string): string => {
    const zones: Record<string, string> = {
      'barcelona': 'GMT+1',
      'tokyo': 'GMT+9',
      'bangkok': 'GMT+7',
      'prague': 'GMT+1',
      'singapore': 'GMT+8',
      'amsterdam': 'GMT+1'
    };
    return zones[city.toLowerCase()] || 'GMT';
  };

  const calculateBudgetRange = (multiplier: number): string => {
    const base = 150;
    const daily = Math.round(base * multiplier);
    return `$${daily}/day`;
  };

  const filterDestinations = () => {
    let filtered = destinations;

    if (searchQuery) {
      filtered = filtered.filter(dest =>
        dest.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dest.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dest.bestFor.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterRegion !== 'all') {
      filtered = filtered.filter(dest => dest.region.toLowerCase() === filterRegion);
    }

    setFilteredDestinations(filtered);
  };

  const regions = ['all', 'europe', 'asia', 'americas', 'africa', 'oceania'];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Finding Perfect Destinations...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your preferences and finding the best matches</p>
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
          <MapPin className="w-5 h-5 text-indigo-600" />
          Choose Your Destination
        </CardTitle>
        <p className="text-gray-600">
          Based on your preferences: {preferences.destination} • {preferences.budget} budget • {preferences.interests}
        </p>
        
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search destinations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="px-3 py-2 border rounded-md bg-white"
            >
              {regions.map(region => (
                <option key={region} value={region}>
                  {region === 'all' ? 'All Regions' : region.charAt(0).toUpperCase() + region.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredDestinations.map((destination, index) => (
              <motion.div
                key={destination.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-xl hover:scale-105 ${
                    selectedDestination?.id === destination.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''
                  }`}
                  onClick={() => onDestinationSelect(destination)}
                >
                  <div className="relative">
                    <img 
                      src={destination.image} 
                      alt={destination.city}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    {destination.trending && (
                      <Badge className="absolute top-2 right-2 bg-red-500 text-white">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                      <Plane className="w-3 h-3 inline mr-1" />
                      {destination.flightTime}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-lg">{destination.city}</h3>
                        <p className="text-gray-600 text-sm">{destination.country}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium">{destination.rating}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-600">
                      <div>🌡️ {destination.temperature}</div>
                      <div>🕐 {destination.timeZone}</div>
                      <div>💰 {destination.budget}</div>
                      <div>🗣️ {destination.language.split(',')[0]}</div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {destination.bestFor.slice(0, 3).map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {destination.bestFor.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{destination.bestFor.length - 3}
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {destination.reasoning}
                    </p>
                    
                    <div className="bg-blue-50 p-2 rounded text-xs text-blue-800">
                      <strong>Local Tip:</strong> {destination.localTip}
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {destination.visaRequired ? (
                          <span className="text-orange-600">📋 Visa Required</span>
                        ) : (
                          <span className="text-green-600">✅ Visa Free</span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant={selectedDestination?.id === destination.id ? "default" : "outline"}
                      >
                        {selectedDestination?.id === destination.id ? (
                          <>
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            Selected
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Select
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {filteredDestinations.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No destinations found matching your criteria</p>
            <Button 
              variant="outline" 
              onClick={() => { setSearchQuery(''); setFilterRegion('all'); }}
              className="mt-2"
            >
              Clear Filters
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}