// hooks/useTravelPlan.ts
import { useState, useCallback, useEffect, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from 'sonner';

export interface TravelPreferences {
  destination: string;
  comingFrom: string;
  budget: string;
  startDate: string;
  endDate: string;
  travelers: string;
  interests: string;
}

export interface Activity {
  time: string;
  activity: string;
  type: string;
  duration?: string;
  cost?: string;
  location?: string;
  specificPlace?: string;
  address?: string;
  description?: string;
  tips?: string[];
  localCurrency?: string;
  culturalNotes?: string;
  bookingRequired?: boolean;
  image?: string;
}

export interface DaySchedule {
  day: number;
  date: string;
  title: string;
  theme?: string;
  activities: Activity[];
  dailyBudget: string;
  notes?: string[];
  highlights?: string[];
}

export interface BookingInfo {
  hotels: any[];
  restaurants: any[];
  activities: any[];
  flights: any[];
  bookingTips?: string[];
}

export interface Itinerary {
  destination: string;
  schedule: DaySchedule[];
  totalBudget: {
    amount: string;
    currency?: string;
    breakdown: Record<string, string>;
  };
  localInsights?: any[];
  bookingInfo?: BookingInfo;
  logistics?: {
    transportation: string;
    packingTips: string[];
    localTips: string[];
  };
  confidence?: number;
}

export interface TravelPlan {
  itinerary: Itinerary | null;
  recommendations: any[];
  workflow_data?: any;
  orchestration?: any;
}

export interface PlanState {
  status: 'idle' | 'loading' | 'streaming' | 'complete' | 'error';
  progress: number;
  currentAgent: string | null;
  error: string | null;
}

interface UseTravelPlanOptions {
  onPlanUpdate?: (plan: TravelPlan) => void;
  onAgentProgress?: (agent: string, progress: number) => void;
  onError?: (error: Error) => void;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useTravelPlan(planId: string | null, options?: UseTravelPlanOptions) {
  const [plan, setPlan] = useState<TravelPlan | null>(null);
  const [planState, setPlanState] = useState<PlanState>({
    status: 'idle',
    progress: 0,
    currentAgent: null,
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use SWR for cached plan data
  const { data: cachedPlan, mutate: mutateCachedPlan } = useSWR<TravelPlan>(
    planId ? `/api/chat/${planId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  // Sync cached plan with local state
  useEffect(() => {
    if (cachedPlan && !plan) {
      setPlan(cachedPlan);
    }
  }, [cachedPlan, plan]);

  // Generate a new travel plan with streaming progress
  const generatePlan = useCallback(
    async (preferences: TravelPreferences) => {
      // Abort any previous generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setPlanState({
        status: 'loading',
        progress: 0,
        currentAgent: 'city-selector',
        error: null,
      });

      try {
        const response = await fetch('/api/travel-planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.details || errorData.error || 'Failed to generate plan');
        }

        const result = await response.json();

        const newPlan: TravelPlan = {
          itinerary: result.itinerary,
          recommendations: result.recommendations || [],
          workflow_data: result.workflow_data,
          orchestration: result.orchestration,
        };

        setPlan(newPlan);
        setPlanState({
          status: 'complete',
          progress: 100,
          currentAgent: null,
          error: null,
        });

        options?.onPlanUpdate?.(newPlan);

        // Cache the plan
        if (planId) {
          await mutateCachedPlan(newPlan, false);
        }

        return newPlan;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return null;
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setPlanState({
          status: 'error',
          progress: 0,
          currentAgent: null,
          error: errorMessage,
        });
        
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [planId, mutateCachedPlan, options]
  );

  // Send a chat message and update the plan
  const sendMessage = useCallback(
    async (message: string) => {
      if (!plan || !planId) {
        throw new Error('No plan available');
      }

      try {
        const response = await fetch('/api/chat-with-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId,
            message,
            currentPlan: plan,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const result = await response.json();

        // If the plan was updated, sync state
        if (result.updatedPlan) {
          const updatedPlan: TravelPlan = {
            ...plan,
            itinerary: result.updatedPlan.itinerary,
            recommendations: result.updatedPlan.recommendations || plan.recommendations,
          };

          setPlan(updatedPlan);
          await mutateCachedPlan(updatedPlan, false);
          options?.onPlanUpdate?.(updatedPlan);
        }

        return result;
      } catch (error) {
        options?.onError?.(error as Error);
        throw error;
      }
    },
    [plan, planId, mutateCachedPlan, options]
  );

  // Update the itinerary directly
  const updateItinerary = useCallback(
    async (updatedItinerary: Partial<Itinerary>) => {
      if (!plan) return;

      const updatedPlan: TravelPlan = {
        ...plan,
        itinerary: {
          ...plan.itinerary!,
          ...updatedItinerary,
        },
      };

      setPlan(updatedPlan);
      
      if (planId) {
        await mutateCachedPlan(updatedPlan, false);
      }
      
      options?.onPlanUpdate?.(updatedPlan);
      
      return updatedPlan;
    },
    [plan, planId, mutateCachedPlan, options]
  );

  // Update bookings
  const updateBookings = useCallback(
    async (bookingUpdates: Partial<BookingInfo>) => {
      if (!plan?.itinerary) return;

      const currentBookingInfo = plan.itinerary.bookingInfo || {
        hotels: [],
        restaurants: [],
        activities: [],
        flights: [],
      };

      const updatedBookingInfo: BookingInfo = {
        ...currentBookingInfo,
        ...bookingUpdates,
      };

      return updateItinerary({ bookingInfo: updatedBookingInfo });
    },
    [plan, updateItinerary]
  );

  // Refresh booking data from external sources
  const refreshBookings = useCallback(async () => {
    if (!plan?.itinerary?.destination) return;

    try {
      const destination = plan.itinerary.destination;
      const dates = {
        start: plan.workflow_data?.preferences?.startDate || new Date().toISOString().split('T')[0],
        end: plan.workflow_data?.preferences?.endDate || new Date().toISOString().split('T')[0],
      };

      const [hotelsRes, restaurantsRes, activitiesRes, flightsRes] = await Promise.allSettled([
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination, type: 'hotel', dates }),
        }),
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination, type: 'restaurant', dates }),
        }),
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination, type: 'activity', dates }),
        }),
        fetch('/api/booking-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ destination, type: 'flight', dates }),
        }),
      ]);

      const extractResults = async (res: PromiseSettledResult<Response>) => {
        if (res.status === 'fulfilled' && res.value.ok) {
          const data = await res.value.json();
          return data.results || [];
        }
        return [];
      };

      await updateBookings({
        hotels: await extractResults(hotelsRes),
        restaurants: await extractResults(restaurantsRes),
        activities: await extractResults(activitiesRes),
        flights: await extractResults(flightsRes),
      });

      toast.success('Booking data refreshed!');
    } catch (error) {
      console.error('Failed to refresh bookings:', error);
      toast.error('Failed to refresh booking data');
    }
  }, [plan, updateBookings]);

  // Cancel ongoing plan generation
  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setPlanState({
        status: 'idle',
        progress: 0,
        currentAgent: null,
        error: null,
      });
    }
  }, []);

  // Reset the plan state
  const reset = useCallback(() => {
    setPlan(null);
    setPlanState({
      status: 'idle',
      progress: 0,
      currentAgent: null,
      error: null,
    });
    if (planId) {
      mutateCachedPlan(undefined, false);
    }
  }, [planId, mutateCachedPlan]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    plan,
    planState,
    isLoading: planState.status === 'loading' || planState.status === 'streaming',
    isComplete: planState.status === 'complete',
    hasError: planState.status === 'error',
    error: planState.error,
    
    // Actions
    generatePlan,
    sendMessage,
    updateItinerary,
    updateBookings,
    refreshBookings,
    cancelGeneration,
    reset,
    
    // For direct mutations
    setPlan,
    mutatePlan: mutateCachedPlan,
  };
}

// Hook for syncing chat with bookings
export function useChatBookingSync(plan: TravelPlan | null) {
  const [syncedBookings, setSyncedBookings] = useState<BookingInfo>({
    hotels: [],
    restaurants: [],
    activities: [],
    flights: [],
  });

  // Extract and sync bookings from itinerary schedule
  useEffect(() => {
    if (!plan?.itinerary) return;

    const bookingInfo = plan.itinerary.bookingInfo;
    const schedule = plan.itinerary.schedule || [];

    // Extract scheduled activities that need booking
    const scheduledActivities = schedule
      .flatMap((day) => day.activities || [])
      .filter((activity) => activity.bookingRequired);

    // Extract dining recommendations from schedule
    const scheduledDining = schedule
      .flatMap((day) => day.activities || [])
      .filter((activity) => activity.type === 'dining' || activity.type === 'Food');

    setSyncedBookings({
      hotels: bookingInfo?.hotels || [],
      restaurants: [
        ...(bookingInfo?.restaurants || []),
        ...scheduledDining
          .filter((d) => !bookingInfo?.restaurants?.some((r: any) => r.name === d.activity))
          .map((d) => ({
            name: d.activity || d.specificPlace,
            time: d.time,
            cost: d.cost,
            location: d.location,
            category: 'restaurant',
          })),
      ],
      activities: [
        ...(bookingInfo?.activities || []),
        ...scheduledActivities
          .filter((a) => !bookingInfo?.activities?.some((act: any) => act.name === a.activity))
          .map((a) => ({
            name: a.activity || a.specificPlace,
            time: a.time,
            cost: a.cost,
            location: a.location,
            bookingRequired: a.bookingRequired,
            category: 'activity',
          })),
      ],
      flights: bookingInfo?.flights || [],
    });
  }, [plan]);

  return { syncedBookings };
}
