interface BookingInfo {
    hotels?: any[];
    restaurants?: any[];
    activities?: any[];
}

interface Plan {
    bookingInfo?: BookingInfo;
}

interface CuratedResult {
    hotels: any[];
    restaurants: any[];
    activities: any[];
}

export function useCurated(plan: Plan): CuratedResult {
    return {
        hotels:      plan?.bookingInfo?.hotels      ?? [],
        restaurants: plan?.bookingInfo?.restaurants ?? [],
        activities:  plan?.bookingInfo?.activities  ?? []
    };
}