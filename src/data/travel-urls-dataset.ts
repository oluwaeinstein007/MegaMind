/**
 * Travel Information URLs Dataset
 * Organized by product type for training travel information ingestor
 */

export interface TravelUrl {
    url: string;
    description: string;
    dataType?: string;
  }
  
  export interface TravelUrlsDataset {
    [category: string]: TravelUrl[];
  }
  
  export const travelUrls: TravelUrlsDataset = {
    // VISA & TRAVEL AUTHORIZATION
    visa: [
      { url: "https://travel.state.gov/content/travel/en/us-visas.html", description: "US Department of State - Visa Information" },
      { url: "https://www.gov.uk/browse/visas-immigration", description: "UK Government - Visas and Immigration" },
      { url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada.html", description: "Canada Visitor Visa" },
      { url: "https://www.homeaffairs.gov.au/entering-and-leaving-australia/visas", description: "Australian Visa Information" },
      { url: "https://www.schengenvisainfo.com/", description: "Schengen Visa Information" },
      { url: "https://www.eta.homeaffairs.gov.au/", description: "Australian ETA" },
      { url: "https://esta.cbp.dhs.gov/", description: "US ESTA Application" },
      { url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html", description: "Canada eTA" },
      { url: "https://www.evisa.gov.tr/en/", description: "Turkey e-Visa" },
      { url: "https://indianvisaonline.gov.in/evisa/tvoa.html", description: "India e-Visa" },
      { url: "https://www.immigration.govt.nz/new-zealand-visas", description: "New Zealand Visa Information" },
      { url: "https://www.mofa.go.jp/j_info/visit/visa/index.html", description: "Japan Visa Information" },
      { url: "https://www.mfa.gov.sg/Services/Visa-Services", description: "Singapore Visa Services" },
      { url: "https://www.visahq.com/", description: "VisaHQ - Global Visa Services" },
      { url: "https://cibtvisas.com/", description: "CIBTvisas - Visa Processing" }
    ],
  
    // FLIGHTS & AIRLINES
    flights: [
      { url: "https://www.iata.org/", description: "International Air Transport Association" },
      { url: "https://www.flightradar24.com/", description: "Flight Tracking" },
      { url: "https://www.google.com/travel/flights", description: "Google Flights" },
      { url: "https://www.skyscanner.com/", description: "Skyscanner Flight Search" },
      { url: "https://www.kayak.com/flights", description: "Kayak Flights" },
      { url: "https://www.expedia.com/Flights", description: "Expedia Flights" },
      { url: "https://www.momondo.com/", description: "Momondo Flight Comparison" },
      { url: "https://www.united.com/", description: "United Airlines" },
      { url: "https://www.delta.com/", description: "Delta Airlines" },
      { url: "https://www.aa.com/", description: "American Airlines" },
      { url: "https://www.emirates.com/", description: "Emirates Airlines" },
      { url: "https://www.britishairways.com/", description: "British Airways" },
      { url: "https://www.lufthansa.com/", description: "Lufthansa" },
      { url: "https://www.airfrance.com/", description: "Air France" },
      { url: "https://www.qantas.com/", description: "Qantas Airways" },
      { url: "https://www.singaporeair.com/", description: "Singapore Airlines" },
      { url: "https://www.cathaypacific.com/", description: "Cathay Pacific" },
      { url: "https://www.ryanair.com/", description: "Ryanair Budget Airline" },
      { url: "https://www.southwest.com/", description: "Southwest Airlines" },
      { url: "https://www.jetblue.com/", description: "JetBlue Airways" }
    ],
  
    // ACCOMMODATION
    accommodation: [
      { url: "https://www.booking.com/", description: "Booking.com - Hotels" },
      { url: "https://www.airbnb.com/", description: "Airbnb - Vacation Rentals" },
      { url: "https://www.hotels.com/", description: "Hotels.com" },
      { url: "https://www.expedia.com/Hotels", description: "Expedia Hotels" },
      { url: "https://www.marriott.com/", description: "Marriott Hotels" },
      { url: "https://www.hilton.com/", description: "Hilton Hotels" },
      { url: "https://www.ihg.com/", description: "InterContinental Hotels" },
      { url: "https://www.hyatt.com/", description: "Hyatt Hotels" },
      { url: "https://www.hostelworld.com/", description: "Hostelworld - Budget Accommodation" },
      { url: "https://www.vrbo.com/", description: "Vrbo - Vacation Rentals" },
      { url: "https://www.agoda.com/", description: "Agoda - Asia Pacific Hotels" },
      { url: "https://www.trivago.com/", description: "Trivago Hotel Comparison" },
      { url: "https://www.priceline.com/", description: "Priceline Hotels" },
      { url: "https://www.hotwire.com/", description: "Hotwire Hotel Deals" },
      { url: "https://www.hostelpass.com/", description: "Hostel Booking Platform" }
    ],
  
    // EXPERIENCES & TOURS
    experiences: [
      { url: "https://www.viator.com/", description: "Viator - Tours & Activities" },
      { url: "https://www.getyourguide.com/", description: "GetYourGuide - Activities" },
      { url: "https://www.airbnb.com/experiences", description: "Airbnb Experiences" },
      { url: "https://www.tripadvisor.com/Attractions", description: "TripAdvisor Attractions" },
      { url: "https://www.klook.com/", description: "Klook - Activities & Tours" },
      { url: "https://www.civitatis.com/en/", description: "Civitatis - Tours" },
      { url: "https://www.tourradar.com/", description: "TourRadar - Multi-day Tours" },
      { url: "https://www.intrepidtravel.com/", description: "Intrepid Travel - Adventure Tours" },
      { url: "https://www.gadventures.com/", description: "G Adventures - Small Group Tours" },
      { url: "https://www.contiki.com/", description: "Contiki - Youth Travel" },
      { url: "https://www.efultimatebreak.com/", description: "EF Ultimate Break - Group Tours" },
      { url: "https://www.thrillophilia.com/", description: "Thrillophilia - Adventure Activities" },
      { url: "https://www.headout.com/", description: "Headout - Last-minute Bookings" },
      { url: "https://www.musement.com/", description: "Musement - Cultural Activities" },
      { url: "https://www.withlocals.com/", description: "WithLocals - Local Experiences" }
    ],
  
    // EVENTS & ENTERTAINMENT
    events: [
      { url: "https://www.eventbrite.com/", description: "Eventbrite - Event Discovery" },
      { url: "https://www.ticketmaster.com/", description: "Ticketmaster - Event Tickets" },
      { url: "https://www.stubhub.com/", description: "StubHub - Ticket Marketplace" },
      { url: "https://www.seatgeek.com/", description: "SeatGeek - Event Tickets" },
      { url: "https://www.vividseats.com/", description: "Vivid Seats - Tickets" },
      { url: "https://www.meetup.com/", description: "Meetup - Local Events" },
      { url: "https://www.timeout.com/", description: "Time Out - City Events" },
      { url: "https://www.dice.fm/", description: "Dice - Music Events" },
      { url: "https://www.songkick.com/", description: "Songkick - Concert Tracking" },
      { url: "https://www.bandsintown.com/", description: "Bandsintown - Live Music" },
      { url: "https://www.festivalsherpa.com/", description: "Festival Sherpa - Music Festivals" },
      { url: "https://www.residentadvisor.net/", description: "Resident Advisor - Electronic Music" },
      { url: "https://www.sportsevents365.com/", description: "Sports Events 365" },
      { url: "https://www.theatricalrights.com/", description: "Theater & Performing Arts" }
    ],
  
    // IMMIGRATION & CUSTOMS
    immigration: [
      { url: "https://www.uscis.gov/", description: "US Citizenship and Immigration Services" },
      { url: "https://www.cbp.gov/", description: "US Customs and Border Protection" },
      { url: "https://www.gov.uk/government/organisations/uk-visas-and-immigration", description: "UK Visas and Immigration" },
      { url: "https://www.canada.ca/en/immigration-refugees-citizenship.html", description: "Immigration, Refugees and Citizenship Canada" },
      { url: "https://immi.homeaffairs.gov.au/", description: "Australian Immigration" },
      { url: "https://www.immigration.govt.nz/", description: "Immigration New Zealand" },
      { url: "https://ec.europa.eu/home-affairs/what-we-do/policies/borders-and-visas_en", description: "EU Immigration Portal" },
      { url: "https://www.iatatravelcentre.com/", description: "IATA Travel Centre - Immigration Info" },
      { url: "https://www.passportindex.org/", description: "Passport Index" },
      { url: "https://www.projectvisa.com/", description: "Project Visa - Immigration Resources" }
    ],
  
    // TRAVEL INSURANCE
    insurance: [
      { url: "https://www.worldnomads.com/", description: "World Nomads Travel Insurance" },
      { url: "https://www.allianzassistance.com/", description: "Allianz Travel Insurance" },
      { url: "https://www.travelguard.com/", description: "Travel Guard Insurance" },
      { url: "https://www.insuremytrip.com/", description: "InsureMyTrip Comparison" },
      { url: "https://www.squaremouth.com/", description: "Squaremouth Insurance Comparison" },
      { url: "https://www.safetywing.com/", description: "SafetyWing - Nomad Insurance" },
      { url: "https://www.heymondo.com/", description: "Heymondo Travel Insurance" },
      { url: "https://www.battleface.com/", description: "Battleface Insurance" },
      { url: "https://www.seven-corners.com/", description: "Seven Corners Insurance" },
      { url: "https://www.imglobal.com/", description: "IMG Travel Insurance" }
    ],
  
    // CAR RENTALS & TRANSPORTATION
    carRentals: [
      { url: "https://www.rentalcars.com/", description: "Rentalcars.com" },
      { url: "https://www.enterprise.com/", description: "Enterprise Rent-A-Car" },
      { url: "https://www.hertz.com/", description: "Hertz Car Rental" },
      { url: "https://www.avis.com/", description: "Avis Car Rental" },
      { url: "https://www.budget.com/", description: "Budget Car Rental" },
      { url: "https://www.sixt.com/", description: "Sixt Rent a Car" },
      { url: "https://www.nationalcar.com/", description: "National Car Rental" },
      { url: "https://www.kayak.com/cars", description: "Kayak Car Rental Search" },
      { url: "https://www.uber.com/", description: "Uber Ride Sharing" },
      { url: "https://www.lyft.com/", description: "Lyft Ride Sharing" },
      { url: "https://www.rome2rio.com/", description: "Rome2Rio - Transport Planning" },
      { url: "https://www.omio.com/", description: "Omio - Multi-modal Transport" },
      { url: "https://www.trainline.com/", description: "Trainline - Rail Booking" },
      { url: "https://www.eurail.com/", description: "Eurail Rail Passes" }
    ],
  
    // CRUISE & WATER TRAVEL
    cruises: [
      { url: "https://www.carnival.com/", description: "Carnival Cruise Line" },
      { url: "https://www.royalcaribbean.com/", description: "Royal Caribbean" },
      { url: "https://www.ncl.com/", description: "Norwegian Cruise Line" },
      { url: "https://www.princess.com/", description: "Princess Cruises" },
      { url: "https://www.hollandamerica.com/", description: "Holland America Line" },
      { url: "https://www.vikingcruises.com/", description: "Viking Cruises" },
      { url: "https://www.celebritycruises.com/", description: "Celebrity Cruises" },
      { url: "https://www.cruisecritic.com/", description: "Cruise Critic Reviews" },
      { url: "https://www.ferryhopper.com/", description: "Ferry Hopper - Ferry Bookings" },
      { url: "https://www.directferries.com/", description: "Direct Ferries" }
    ],
  
    // TRAVEL GUIDES & INFORMATION
    travelGuides: [
      { url: "https://www.lonelyplanet.com/", description: "Lonely Planet Travel Guides" },
      { url: "https://www.tripadvisor.com/", description: "TripAdvisor Reviews" },
      { url: "https://www.ricksteves.com/", description: "Rick Steves Europe" },
      { url: "https://www.fodors.com/", description: "Fodor's Travel" },
      { url: "https://www.frommers.com/", description: "Frommer's Travel Guides" },
      { url: "https://www.roughguides.com/", description: "Rough Guides" },
      { url: "https://www.afar.com/", description: "AFAR Travel Magazine" },
      { url: "https://www.cntraveler.com/", description: "Conde Nast Traveler" },
      { url: "https://www.nationalgeographic.com/travel", description: "National Geographic Travel" },
      { url: "https://www.nomadicmatt.com/", description: "Nomadic Matt - Budget Travel" },
      { url: "https://www.theplanetd.com/", description: "The Planet D - Adventure Travel" },
      { url: "https://www.earthtrekkers.com/", description: "Earth Trekkers" },
      { url: "https://www.atlasobs cura.com/", description: "Atlas Obscura - Unique Destinations" },
      { url: "https://www.seat61.com/", description: "The Man in Seat 61 - Train Travel" }
    ],
  
    // HEALTH & VACCINATION
    health: [
      { url: "https://wwwnc.cdc.gov/travel", description: "CDC Travel Health" },
      { url: "https://www.who.int/travel-advice", description: "WHO Travel Advice" },
      { url: "https://travelhealthpro.org.uk/", description: "Travel Health Pro (UK)" },
      { url: "https://www.passporthealthusa.com/", description: "Passport Health Travel Clinics" },
      { url: "https://travel.gc.ca/travelling/health-safety", description: "Canada Travel Health" },
      { url: "https://www.healthdirect.gov.au/travel-health", description: "Australia Travel Health" },
      { url: "https://www.mdtravelhealth.com/", description: "MD Travel Health" },
      { url: "https://www.iamat.org/", description: "IAMAT - Travel Health Info" },
      { url: "https://www.fitfortravel.nhs.uk/", description: "Fit for Travel (NHS)" }
    ],
  
    // TRAVEL SAFETY & ADVISORIES
    safety: [
      { url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html", description: "US Travel Advisories" },
      { url: "https://www.gov.uk/foreign-travel-advice", description: "UK Foreign Travel Advice" },
      { url: "https://travel.gc.ca/destinations", description: "Canada Travel Advisories" },
      { url: "https://www.smartraveller.gov.au/", description: "Australian Travel Advisories" },
      { url: "https://www.safetravel.govt.nz/", description: "New Zealand Travel Advice" },
      { url: "https://www.osac.gov/", description: "OSAC - Security Information" },
      { url: "https://www.garda.com/", description: "GardaWorld Security Alerts" },
      { url: "https://www.internationalsos.com/", description: "International SOS" }
    ],
  
    // LUGGAGE & TRAVEL GEAR
    luggage: [
      { url: "https://www.samsonite.com/", description: "Samsonite Luggage" },
      { url: "https://www.away.com/", description: "Away Travel Luggage" },
      { url: "https://www.rimowa.com/", description: "Rimowa Luggage" },
      { url: "https://www.tumi.com/", description: "Tumi Travel Gear" },
      { url: "https://www.rei.com/", description: "REI Travel Gear" },
      { url: "https://www.eaglecreek.com/", description: "Eagle Creek Travel Gear" },
      { url: "https://www.osprey.com/", description: "Osprey Backpacks" },
      { url: "https://www.patagonia.com/", description: "Patagonia Travel Gear" }
    ],
  
    // CURRENCY & MONEY EXCHANGE
    currency: [
      { url: "https://www.xe.com/", description: "XE Currency Converter" },
      { url: "https://wise.com/", description: "Wise (TransferWise) Money Transfer" },
      { url: "https://www.revolut.com/", description: "Revolut Travel Card" },
      { url: "https://www.oanda.com/currency-converter/", description: "OANDA Currency Converter" },
      { url: "https://www.travelex.com/", description: "Travelex Currency Exchange" },
      { url: "https://www.icepay.com/", description: "ICE Currency Services" },
      { url: "https://www.schwab.com/", description: "Schwab Bank - No Foreign Fees" }
    ],
  
    // TRAVEL PACKAGES & ALL-INCLUSIVE
    packages: [
      { url: "https://www.costco.com/travel", description: "Costco Travel Packages" },
      { url: "https://www.expedia.com/Vacation-Packages", description: "Expedia Vacation Packages" },
      { url: "https://www.travelocity.com/", description: "Travelocity Packages" },
      { url: "https://www.orbitz.com/", description: "Orbitz Travel Packages" },
      { url: "https://www.cheapcaribbean.com/", description: "CheapCaribbean All-Inclusive" },
      { url: "https://www.applevacations.com/", description: "Apple Vacations" },
      { url: "https://www.funjet.com/", description: "Funjet Vacations" },
      { url: "https://www.sandals.com/", description: "Sandals Resorts All-Inclusive" },
      { url: "https://www.clubmed.us/", description: "Club Med All-Inclusive" }
    ],
  
    // LANGUAGE & TRANSLATION
    language: [
      { url: "https://translate.google.com/", description: "Google Translate" },
      { url: "https://www.duolingo.com/", description: "Duolingo Language Learning" },
      { url: "https://www.babbel.com/", description: "Babbel Language Courses" },
      { url: "https://www.rosettastone.com/", description: "Rosetta Stone" },
      { url: "https://www.italki.com/", description: "iTalki Language Tutors" },
      { url: "https://www.memrise.com/", description: "Memrise Language App" }
    ],
  
    // LOYALTY & REWARDS
    loyalty: [
      { url: "https://www.aa.com/aadvantage", description: "American Airlines AAdvantage" },
      { url: "https://www.united.com/mileageplus", description: "United MileagePlus" },
      { url: "https://www.delta.com/skymiles", description: "Delta SkyMiles" },
      { url: "https://www.marriott.com/loyalty", description: "Marriott Bonvoy" },
      { url: "https://www.hilton.com/honors", description: "Hilton Honors" },
      { url: "https://www.worldofhyatt.com/", description: "World of Hyatt" },
      { url: "https://www.ihg.com/rewardsclub", description: "IHG Rewards" },
      { url: "https://thepointsguy.com/", description: "The Points Guy - Rewards Guide" }
    ],
  
    // TRAVEL APPS & TECH
    travelTech: [
      { url: "https://www.tripit.com/", description: "TripIt Itinerary Manager" },
      { url: "https://www.packpoint.com/", description: "PackPoint Packing List" },
      { url: "https://www.hopper.com/", description: "Hopper Price Prediction" },
      { url: "https://www.citymapper.com/", description: "Citymapper Urban Transit" },
      { url: "https://www.maps.me/", description: "Maps.me Offline Maps" },
      { url: "https://www.sygic.com/", description: "Sygic GPS Navigation" },
      { url: "https://www.wifi.com/", description: "WiFi Map - Internet Access" },
      { url: "https://www.loungebuddy.com/", description: "LoungeBuddy Airport Lounges" }
    ],
  
    // SUSTAINABLE & ECO TRAVEL
    sustainable: [
      { url: "https://www.responsibletravel.com/", description: "Responsible Travel" },
      { url: "https://www.greenpearls.com/", description: "Green Pearls Eco Hotels" },
      { url: "https://bookdifferent.com/", description: "BookDifferent Sustainable Hotels" },
      { url: "https://www.ecolodges.com/", description: "Ecolodges Directory" },
      { url: "https://www.earthchangers.com/", description: "Earth Changers Sustainable Travel" },
      { url: "https://www.sustainabletravel.org/", description: "Sustainable Travel International" },
      { url: "https://travelife.info/", description: "Travelife Sustainability" }
    ],
  
    // DESTINATION-SPECIFIC
    destinations: [
      { url: "https://www.visittheusa.com/", description: "Visit USA Official" },
      { url: "https://www.visitbritain.com/", description: "Visit Britain" },
      { url: "https://www.france.fr/en", description: "France Tourism" },
      { url: "https://www.spain.info/", description: "Spain Tourism" },
      { url: "https://www.italia.it/en", description: "Italy Tourism" },
      { url: "https://www.germany.travel/", description: "Germany Tourism" },
      { url: "https://www.japan.travel/", description: "Japan Tourism" },
      { url: "https://www.australia.com/", description: "Australia Tourism" },
      { url: "https://www.newzealand.com/", description: "New Zealand Tourism" },
      { url: "https://www.incredibleindia.org/", description: "India Tourism" },
      { url: "https://www.tourismthailand.org/", description: "Thailand Tourism" },
      { url: "https://www.visitdubai.com/", description: "Dubai Tourism" },
      { url: "https://www.southafrica.net/", description: "South Africa Tourism" },
      { url: "https://www.visitmexico.com/", description: "Mexico Tourism" },
      { url: "https://www.visit-jordan.com/", description: "Jordan Tourism" }
    ]
  };
  
  // Helper function to get all URLs
  export function getAllUrls(): string[] {
    return Object.values(travelUrls)
      .flat()
      .map(item => item.url);
  }
  
  // Helper function to get URLs by category
  export function getUrlsByCategory(category: keyof typeof travelUrls): TravelUrl[] {
    return travelUrls[category] || [];
  }
  
  // Helper function to get category names
  export function getCategories(): string[] {
    return Object.keys(travelUrls);
  }
  
  // Helper function to count total URLs
  export function getTotalUrlCount(): number {
    return getAllUrls().length;
  }
  
  // Helper function to get URL count by category
  export function getUrlCountByCategory(): Record<string, number> {
    return Object.entries(travelUrls).reduce((acc, [key, urls]) => {
      acc[key] = urls.length;
      return acc;
    }, {} as Record<string, number>);
  }
  
  // Export statistics
  export const datasetStats = {
    totalCategories: Object.keys(travelUrls).length,
    totalUrls: getAllUrls().length,
    urlsByCategory: getUrlCountByCategory()
  };
  
  console.log('📥 Travel URLs Dataset loaded successfully!');
  console.log(`📚 Total Categories: ${datasetStats.totalCategories}`);
  console.log(`🔗 Total URLs: ${datasetStats.totalUrls}`);
  console.log('🗂️ Categories:', getCategories().join(', '));


  // Example usage:  // console.log(getUrlsByCategory('visa'));
  // console.log(getAllUrls());  // console.log(datasetStats);
  /*
    import { travelUrls, getAllUrls, getUrlsByCategory } from './data/travel-urls-dataset';

    // Use it in your ingestor
    const allUrls = getAllUrls();
    const visaUrls = getUrlsByCategory('visa');
 */


    /*    Summary of Travel URLs Dataset
    -----------------------------------
    Visa (15 URLs) - Government visa sites, e-visa portals, visa services
    Flights (20 URLs) - Airlines, flight search engines, booking platforms
    Accommodation (15 URLs) - Hotels, vacation rentals, hostels
    Experiences (15 URLs) - Tours, activities, local experiences
    Events (14 URLs) - Concerts, festivals, sports events
    Immigration (10 URLs) - Government immigration departments
    Insurance (10 URLs) - Travel insurance providers
    Car Rentals (14 URLs) - Car rental companies and transport planning
    Cruises (10 URLs) - Cruise lines and ferry services
    Travel Guides (14 URLs) - Destination guides and travel magazines
    Health (9 URLs) - Travel health and vaccination info
    Safety (8 URLs) - Travel advisories and safety info
    Luggage (8 URLs) - Luggage and travel gear brands
    Currency (7 URLs) - Currency converters and money transfer
    Packages (9 URLs) - Travel package providers
    Language (6 URLs) - Translation and language learning
    Loyalty (8 URLs) - Airline and hotel loyalty programs
    Travel Tech (8 URLs) - Travel apps and tech tools
    Sustainable (7 URLs) - Sustainable travel resources
    Destinations (15 URLs) - Official tourism sites for popular destinations

    Total:  228 URLs across 20 categories

    This dataset provides a comprehensive set of URLs covering all major aspects of travel, organized by product type. It can be used to train an ingestor to fetch and process travel-related information effectively.
    */