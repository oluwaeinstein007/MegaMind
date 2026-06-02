'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users, 
  Bot,
  CheckCircle2,
  Clock,
  Download,
  Sparkles,
  Search,
  Calculator,
  Zap,
  Network,
  Brain,
  Target,
  History,
  MessageSquare,
  ExternalLink,
  Menu,
  X,
  Wifi,
  WifiOff,
  AlertCircle,
  Plane,
  Globe,
  Loader2,
  PenLine,
  ListChecks,
  ArrowRight,
  Edit3,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { AgentActivity } from '@/components/agent-activity';
import { ItineraryPreview } from '@/components/itinerary-preview';
import { ChatInterface } from '@/components/chat-interface';
import { BookingRecommendations } from '@/components/booking-recommendations';
import { TravelHistory } from '@/components/travel-history';
import { ThemeToggle } from '@/components/theme-toggle';
import { DestinationSelector } from '@/components/destination-selector';
import { CacheKeyHelpers } from '@/lib/utils/cache-keys';
import { cn } from '@/lib/utils';

interface TravelPreferences {
  destination: string;
  comingFrom: string;
  budget: string;
  startDate: string;
  endDate: string;
  travelers: string;
  interests: string;
}

interface AgentState {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'error';
  progress: number;
  lastActivity: string;
  results?: any;
}

interface OrchestrationData {
  steps: number;
  agents_executed: string[];
  tool_calls: number;
  execution_time: number;
}

export function TravelPlanningInterface() {
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('planner');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [preferences, setPreferences] = useState<TravelPreferences>({
    destination: '',
    comingFrom: '',
    budget: '',
    startDate: '',
    endDate: '',
    travelers: '',
    interests: ''
  });
  const [selectedDestination, setSelectedDestination] = useState<any>(null);
  const [agents, setAgents] = useState<AgentState[]>([
    {
      id: 'city-selector',
      name: 'City Selector Agent',
      status: 'waiting',
      progress: 0,
      lastActivity: 'Ready to analyze destinations with TavilySearchResults'
    },
    {
      id: 'local-expert',
      name: 'Local Expert Agent',
      status: 'waiting',
      progress: 0,
      lastActivity: 'Standing by for local insights and hidden gems'
    },
    {
      id: 'travel-concierge',
      name: 'Travel Concierge Agent',
      status: 'waiting',
      progress: 0,
      lastActivity: 'Ready to plan logistics with Calculate tool'
    }
  ]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [itinerary, setItinerary] = useState<any>(null);
  const [orchestrationData, setOrchestrationData] = useState<OrchestrationData | null>(null);
  const [workflowData, setWorkflowData] = useState<any>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('travelmind_user_id');
      if (stored) return stored;
      const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('travelmind_user_id', newId);
      return newId;
    }
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const [selectedHistoryPlan, setSelectedHistoryPlan] = useState<any>(null);
  const [redisConnected, setRedisConnected] = useState<boolean | null>(null);
  const [bookingRefreshKey, setBookingRefreshKey] = useState(0);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // ── Natural Language Input Mode ──
  const [inputMode, setInputMode] = useState<'form' | 'freetext'>('form');
  const [freetextDescription, setFreetextDescription] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleInputChange = (field: keyof TravelPreferences, value: string) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const canProceed = () => {
    return Object.values(preferences).every(value => value.trim() !== '');
  };

  // ── Freetext Trip Description → Structured Fields ──
  const parseFreetextTrip = async () => {
    if (!freetextDescription.trim() || isParsing) return;
    setIsParsing(true);
    try {
      const response = await fetch('/api/parse-trip-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: freetextDescription.trim() }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to parse');
      }
      const parsed = await response.json();
      setParsedPreview(parsed);
      // Auto-populate the form fields
      setPreferences({
        destination: parsed.destination || '',
        comingFrom: parsed.comingFrom || '',
        budget: parsed.budget || '',
        startDate: parsed.startDate || '',
        endDate: parsed.endDate || '',
        travelers: parsed.travelers || '',
        interests: parsed.interests || '',
      });
      toast.success('Trip details extracted!', {
        description: parsed.summary,
      });
    } catch (error) {
      console.error('Parse error:', error);
      toast.error('Could not understand your description', {
        description: error instanceof Error ? error.message : 'Please try rephrasing or use the form.',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const confirmParsedAndPlan = () => {
    if (!canProceed()) {
      toast.error('Some fields are still empty. Please fill them in.');
      return;
    }
    setParsedPreview(null);
    startTravelPlanning();
  };

  const handleDestinationSelect = (destination: any) => {
    setSelectedDestination(destination);
    setPreferences(prev => ({
      ...prev,
      destination: `${destination.city}, ${destination.country}`
    }));
  };

  const startTravelPlanning = async () => {
    if (!canProceed()) {
      toast.error('Please fill in all travel preferences');
      return;
    }

    setStep(2);
    setIsProcessing(true);
    
    // Simulate agent processing with realistic timing
    const agentSteps = [
      { agent: 'city-selector', duration: 2000, message: 'Analyzing destinations and preferences...' },
      { agent: 'local-expert', duration: 3000, message: 'Gathering local insights and hidden gems...' },
      { agent: 'travel-concierge', duration: 2500, message: 'Creating detailed itinerary and logistics...' }
    ];

    let currentProgress = 0;
    
    for (let i = 0; i < agentSteps.length; i++) {
      const agentStep = agentSteps[i];
      
      // Update current agent to active
      setAgents(prev => prev.map(agent => 
        agent.id === agentStep.agent 
          ? { ...agent, status: 'active', lastActivity: agentStep.message }
          : agent
      ));

      // Simulate processing time with progress updates
      const progressIncrement = 100 / agentSteps.length;
      const stepDuration = agentStep.duration;
      const updateInterval = stepDuration / 10;

      for (let j = 0; j < 10; j++) {
        await new Promise(resolve => setTimeout(resolve, updateInterval));
        const stepProgress = (j + 1) * 10;
        const totalProgress = currentProgress + (stepProgress * progressIncrement / 100);
        
        setOverallProgress(totalProgress);
        setAgents(prev => prev.map(agent => 
          agent.id === agentStep.agent 
            ? { ...agent, progress: stepProgress }
            : agent
        ));
      }

      // Mark agent as completed
      setAgents(prev => prev.map(agent => 
        agent.id === agentStep.agent 
          ? { ...agent, status: 'completed', progress: 100, lastActivity: 'Analysis complete ✓' }
          : agent
      ));

      currentProgress += progressIncrement;
    }

    try {
      // Make actual API call
      const response = await fetch('/api/travel-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preferences,
          userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to start travel planning');
      }

      const result = await response.json();
      
      // Set results
      setRecommendations(result.recommendations || []);
      setItinerary(result.itinerary);
      setOrchestrationData(result.orchestration);
      setWorkflowData(result.workflow_data);
      setStep(3);
      
      setOverallProgress(100);
      
      toast.success('Your perfect trip is ready!', {
        description: `${result.orchestration?.steps} steps, ${result.orchestration?.tool_calls} tool calls`
      });
      
    } catch (error) {
      console.error('❌ Travel Planning Error:', error);
      
      toast.error('Failed to generate travel plan', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      
      // Reset agents to error state
      setAgents(prev => prev.map(agent => ({
        ...agent,
        status: 'error',
        lastActivity: error instanceof Error ? error.message : 'Planning failed'
      })));
    } finally {
      setIsProcessing(false);
    }
  };

  const generatePDF = async () => {
    setIsPdfGenerating(true);
    try {
      toast.info('Generating your PDF...', { duration: 2000 });
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          preferences, 
          recommendations, 
          itinerary,
          orchestrationData,
          workflowData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TravelMind-${(itinerary?.destination || preferences.destination || 'itinerary').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('PDF itinerary downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const resetPlanning = () => {
    setStep(1);
    setActiveTab('planner');
    setPreferences({
      destination: '',
      comingFrom: '',
      budget: '',
      startDate: '',
      endDate: '',
      travelers: '',
      interests: ''
    });
    setSelectedDestination(null);
    setAgents(prev => prev.map(agent => ({
      ...agent,
      status: 'waiting',
      progress: 0,
      lastActivity: agent.id === 'city-selector' ? 'Ready to analyze destinations with TavilySearchResults' :
                     agent.id === 'local-expert' ? 'Standing by for local insights and hidden gems' :
                     'Ready to plan logistics with Calculate tool'
    })));
    setOverallProgress(0);
    setIsProcessing(false);
    setRecommendations([]);
    setItinerary(null);
    setOrchestrationData(null);
    setWorkflowData(null);
    setJobId(null);
    setSelectedHistoryPlan(null);
    setRedisConnected(null);
  };

  const handleHistoryPlanSelect = (plan: any) => {
    setSelectedHistoryPlan(plan);
    setPreferences(plan.preferences);
    setRecommendations(plan.result.recommendations || []);
    setItinerary(plan.result.itinerary);
    setOrchestrationData(plan.result.orchestration);
    setWorkflowData(plan.result.workflow_data);
    setStep(3);
    setActiveTab('planner');
    toast.success('Travel plan loaded from history');
  };

  const handlePlanUpdate = (updatedPlan: any) => {
    console.log('🔄 handlePlanUpdate called with:', updatedPlan);
    setIsUpdating(true);

    // Correctly destructure: the plan object contains itinerary, recommendations,
    // workflow_data (with rich_content, city_analysis, etc.)
    if (updatedPlan.itinerary) {
      setItinerary(updatedPlan.itinerary);
    }
    if (updatedPlan.recommendations) {
      setRecommendations(updatedPlan.recommendations);
    }
    // workflow_data holds the structured agent data AND rich_content markdown
    if (updatedPlan.workflow_data) {
      setWorkflowData(updatedPlan.workflow_data);
    } else {
      // If the plan itself IS the workflow_data (legacy shape)
      setWorkflowData(updatedPlan);
    }
    
    // Auto-switch to itinerary tab to show changes
    console.log('🔄 Switching to itinerary tab...');
    setTimeout(() => {
      setActiveTab('itinerary');
      setIsUpdating(false);
      console.log('🔄 Tab switched to itinerary');
    }, 500);
    
    toast.success('Itinerary updated! Switching to Itinerary tab...');
  };

  const handleBookingRefresh = () => {
    console.log('🔄 Refreshing booking recommendations after chat modification');
    setBookingRefreshKey(prev => prev + 1);
    toast.info('Refreshing booking recommendations...');
  };

  const handleCitySwitch = async (city: string) => {
    if (city === preferences.destination) return;      // already selected
    toast.info(`Loading itinerary for ${city}…`);
    setIsProcessing(true);

    try {
      // Quick synchronous endpoint
      const res = await fetch(`/api/quick-plan?city=${encodeURIComponent(city)}`);
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();

      // update local state
      setPreferences(prev => ({ ...prev, destination: city }));
      setRecommendations(data.recommendations || []);
      setItinerary(data.itinerary);
      setWorkflowData(data.workflow_data);
      setOrchestrationData(data.workflow_data?.orchestration ?? null);

      toast.success(`Switched to ${city}`);
    } catch (err:any) {
      console.error(err);
      toast.error('Failed to load new city', { description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      {/* Header */}
      <header className="border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl shadow-lg">
                <Network className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  TravelMind
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">AI Travel Orchestration</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Brain className="w-3 h-3" />
                <span>StateGraph</span>
                <Search className="w-3 h-3" />
                <span>TavilySearch</span>
                <Calculator className="w-3 h-3" />
                <span>Calculate</span>
              </div>
              <ThemeToggle />
            </div>
            
            <div className="md:hidden flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
          
          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="md:hidden mt-4 border-t pt-4"
              >
                <div className="flex flex-col gap-2">
                  <Button
                    variant={activeTab === 'planner' ? 'default' : 'ghost'}
                    onClick={() => { setActiveTab('planner'); setMobileMenuOpen(false); }}
                    className="justify-start"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Travel Planner
                  </Button>
                  <Button
                    variant={activeTab === 'history' ? 'default' : 'ghost'}
                    onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}
                    className="justify-start"
                  >
                    <History className="w-4 h-4 mr-2" />
                    History
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Desktop Navigation */}
        <div className="hidden md:block mb-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
              <TabsTrigger value="planner" className="flex items-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Zap className="w-4 h-4" />
                Travel Planner
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <History className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {activeTab === 'planner' && (
          <>
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 overflow-x-auto">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center gap-2">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    step >= stepNumber 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-slate-200 dark:border-slate-600'
                  }`}>
                    {step > stepNumber ? <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" /> : stepNumber}
                  </div>
                  <span className={`text-xs md:text-sm font-medium transition-colors ${step >= stepNumber ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                    {stepNumber === 1 ? 'Preferences' : stepNumber === 2 ? 'Processing' : 'Results'}
                  </span>
                  {stepNumber < 3 && (
                    <div className={`w-4 md:w-8 h-0.5 transition-colors ${step > stepNumber ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Travel Preferences */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto space-y-6"
              >
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-xl">
                  <CardHeader className="text-center">
                    <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                      <Globe className="w-6 h-6 text-indigo-600" />
                      Plan Your Perfect Trip
                    </CardTitle>
                    <p className="text-slate-600 dark:text-slate-400">
                      Tell us about your travel preferences and we'll create a personalized itinerary
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Input Mode Toggle */}
                    <div className="flex justify-center mb-6">
                      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-xs w-full shadow-inner border border-slate-200/50 dark:border-slate-700/30">
                        <button
                          type="button"
                          onClick={() => setInputMode('form')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 focus:outline-none",
                            inputMode === 'form'
                              ? "bg-white dark:bg-slate-700 shadow-md text-indigo-600 dark:text-indigo-400 font-extrabold"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          <ListChecks className="w-3.5 h-3.5" />
                          Detailed Form
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode('freetext')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-300 focus:outline-none",
                            inputMode === 'freetext'
                              ? "bg-white dark:bg-slate-700 shadow-md text-indigo-600 dark:text-indigo-400 font-extrabold"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          )}
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          Describe Your Trip
                        </button>
                      </div>
                    </div>

                    {inputMode === 'freetext' ? (
                      <div className="space-y-6">
                        <div className="relative group">
                          {/* Animated Glow Border */}
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
                          <div className="relative space-y-2">
                            <Label htmlFor="freetext-description" className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5 pl-1">
                              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                              What kind of trip are you dreaming of?
                            </Label>
                            <Textarea
                              id="freetext-description"
                              placeholder="e.g., I want to take a 4-day budget solo trip to Bangkok starting next Monday, mostly interested in food tours and cultural experiences, coming from Singapore."
                              value={freetextDescription}
                              onChange={(e) => setFreetextDescription(e.target.value)}
                              className="min-h-[140px] rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-400 shadow-md leading-relaxed text-sm p-4 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>

                        <Button
                          onClick={parseFreetextTrip}
                          disabled={!freetextDescription.trim() || isParsing}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-300"
                        >
                          {isParsing ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              Gemini is crafting details...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-5 h-5 mr-2" />
                              Extract Trip Details
                            </>
                          )}
                        </Button>

                        {/* Parsed Preview Confirmation Card */}
                        {parsedPreview && (
                          <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 border border-indigo-100 dark:border-indigo-950 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl space-y-4"
                          >
                            <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-950/50 pb-3">
                              <h4 className="font-bold text-slate-850 dark:text-slate-200 text-sm flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                Extracted Plan Confirmation
                              </h4>
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-200/50 dark:border-emerald-900/30">
                                {Math.round(parsedPreview.confidence * 100)}% Confidence
                              </Badge>
                            </div>

                            <p className="text-xs text-slate-650 dark:text-slate-350 font-semibold italic">
                              "{parsedPreview.summary}"
                            </p>

                            <div className="flex flex-wrap gap-2.5">
                              {parsedPreview.destination && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm text-slate-750 dark:text-slate-250">
                                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>To: {parsedPreview.destination}</span>
                                </div>
                              )}
                              {parsedPreview.comingFrom && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm text-slate-750 dark:text-slate-250">
                                  <Plane className="w-3.5 h-3.5 text-blue-500" />
                                  <span>From: {parsedPreview.comingFrom}</span>
                                </div>
                              )}
                              {parsedPreview.startDate && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm text-slate-750 dark:text-slate-250">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>{parsedPreview.startDate} to {parsedPreview.endDate}</span>
                                </div>
                              )}
                              {parsedPreview.budget && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm capitalize text-slate-750 dark:text-slate-250">
                                  <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                                  <span>{parsedPreview.budget}</span>
                                </div>
                              )}
                              {parsedPreview.travelers && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-xl text-xs font-semibold shadow-sm text-slate-750 dark:text-slate-250">
                                  <Users className="w-3.5 h-3.5 text-purple-500" />
                                  <span>{parsedPreview.travelers} Traveler(s)</span>
                                </div>
                              )}
                            </div>

                            {parsedPreview.inferredFields.length > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-amber-605 dark:text-amber-395 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 font-bold">
                                <Info className="w-3 h-3 flex-shrink-0" />
                                <span>Note: {parsedPreview.inferredFields.join(', ')} fields were automatically inferred based on default patterns.</span>
                              </div>
                            )}

                            <div className="flex gap-3 pt-2">
                              <Button
                                variant="outline"
                                onClick={() => setInputMode('form')}
                                className="flex-1 border-slate-200 dark:border-slate-700 font-bold text-xs rounded-xl"
                              >
                                <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                                Tweak in Form
                              </Button>
                              <Button
                                onClick={confirmParsedAndPlan}
                                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl"
                              >
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                Confirm & Plan Trip
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="destination" className="text-slate-700 dark:text-slate-300 font-medium">Where do you want to go?</Label>
                            <Input
                              id="destination"
                              placeholder="e.g., Europe, Southeast Asia, Japan, New York"
                              value={preferences.destination}
                              onChange={(e) => handleInputChange('destination', e.target.value)}
                              className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="comingFrom" className="text-slate-700 dark:text-slate-300 font-medium">Where are you coming from?</Label>
                            <Input
                              id="comingFrom"
                              placeholder="e.g., New York, London, Sydney"
                              value={preferences.comingFrom}
                              onChange={(e) => handleInputChange('comingFrom', e.target.value)}
                              className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="budget" className="text-slate-700 dark:text-slate-300 font-medium">Budget Range</Label>
                          <Select 
                            value={preferences.budget} 
                            onValueChange={(value) => handleInputChange('budget', value)}
                          >
                            <SelectTrigger className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600">
                              <SelectValue placeholder="Select your budget range" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="budget">Budget ($0 - $2,000)</SelectItem>
                              <SelectItem value="mid-range">Mid-range ($2,000 - $5,000)</SelectItem>
                              <SelectItem value="luxury">Luxury ($5,000+)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="start-date" className="text-slate-700 dark:text-slate-300 font-medium">Start Date</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={preferences.startDate}
                              onChange={(e) => handleInputChange('startDate', e.target.value)}
                              className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="end-date" className="text-slate-700 dark:text-slate-300 font-medium">End Date</Label>
                            <Input
                              id="end-date"
                              type="date"
                              value={preferences.endDate}
                              onChange={(e) => handleInputChange('endDate', e.target.value)}
                              className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="travelers" className="text-slate-700 dark:text-slate-300 font-medium">Number of Travelers</Label>
                          <Select 
                            value={preferences.travelers} 
                            onValueChange={(value) => handleInputChange('travelers', value)}
                          >
                            <SelectTrigger className="bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600">
                              <SelectValue placeholder="How many people are traveling?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Solo traveler</SelectItem>
                              <SelectItem value="2">2 travelers</SelectItem>
                              <SelectItem value="3-4">3-4 travelers</SelectItem>
                              <SelectItem value="5+">5+ travelers</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="interests" className="text-slate-700 dark:text-slate-300 font-medium">Interests & Activities</Label>
                          <Textarea
                            id="interests"
                            placeholder="e.g., museums, outdoor activities, food tours, nightlife, cultural experiences, adventure sports"
                            value={preferences.interests}
                            onChange={(e) => handleInputChange('interests', e.target.value)}
                            className="min-h-[100px] bg-white/50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                          />
                        </div>

                        <Button 
                          onClick={startTravelPlanning}
                          disabled={!canProceed() || isProcessing}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Create My Perfect Trip
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Destination Selector */}
                {preferences.destination && preferences.comingFrom && (
                  <DestinationSelector
                    preferences={preferences}
                    onDestinationSelect={handleDestinationSelect}
                    selectedDestination={selectedDestination}
                  />
                )}
              </motion.div>
            )}

            {/* Step 2: Processing */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Network className="w-5 h-5 text-indigo-600" />
                      AI Agents Working on Your Trip
                    </CardTitle>
                    <p className="text-slate-600 dark:text-slate-400">
                      Our specialized AI agents are analyzing your preferences and creating your perfect itinerary
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Overall Progress</span>
                        <span>{Math.round(overallProgress)}%</span>
                      </div>
                      <Progress value={overallProgress} className="h-2" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {agents.map((agent) => (
                        <AgentActivity key={agent.id} agent={agent} />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
                  <CardHeader>
                    <CardTitle className="text-indigo-900 dark:text-indigo-100">Why Our AI is Special</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800 dark:text-green-400">Multi-Agent Intelligence</p>
                          <p className="text-sm text-green-600 dark:text-green-300">Specialized experts for each aspect</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-400">Real-time Data</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">Live search and current information</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Results */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto space-y-6"
              >
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      Your Perfect Trip is Ready!
                    </CardTitle>
                    {orchestrationData && (
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                        <span>🔄 {orchestrationData.steps} orchestration steps</span>
                        <span>🤖 {orchestrationData.agents_executed?.length || 0} agents executed</span>
                        <span>🛠️ {orchestrationData.tool_calls} tool calls</span>
                        <span>⏱️ {Math.round(orchestrationData.execution_time / 1000)}s execution time</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        onClick={generatePDF} 
                        variant="outline" 
                        className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        disabled={isPdfGenerating}
                      >
                        {isPdfGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF
                          </>
                        )}
                      </Button>
                      <Button onClick={resetPlanning} variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                        Plan Another Trip
                      </Button>
                    </div>
                  </CardHeader>
                </Card>

                <Tabs defaultValue="itinerary" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <TabsTrigger value="itinerary" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Itinerary</TabsTrigger>
                    <TabsTrigger value="chat" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Chat & Modify
                    </TabsTrigger>
                    <TabsTrigger value="bookings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Bookings
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="itinerary">
                    <ItineraryPreview
                      preferences={preferences}
                      recommendations={recommendations}
                      itinerary={itinerary}
                      workflowData={workflowData}
                      /* THE ONLY NEW PROP ↓↓↓ */
                      onSelectCity={handleCitySwitch}
                    />
                  </TabsContent>
                  
                  <TabsContent value="chat">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ChatInterface
                        planId={CacheKeyHelpers.generateTravelPlanKey(preferences)}
                        initialData={{
                          itinerary: itinerary,
                          recommendations: recommendations,
                          workflow_data: workflowData,
                          orchestration: orchestrationData
                        }}
                        onPlanUpdate={handlePlanUpdate}
                        onBookingRefresh={handleBookingRefresh}
                      />
                      <div className="space-y-4">
                        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                          <CardHeader>
                            <CardTitle className="text-lg">Quick Modifications</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start">
                              <DollarSign className="w-4 h-4 mr-2" />
                              Reduce budget by 20%
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="w-4 h-4 mr-2" />
                              Add more cultural activities
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                              <MapPin className="w-4 h-4 mr-2" />
                              Find romantic restaurants
                            </Button>
                            <Button variant="outline" className="w-full justify-start">
                              <Users className="w-4 h-4 mr-2" />
                              Optimize for group travel
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="bookings">
                    <BookingRecommendations
                      destination={itinerary?.destination || preferences.destination}
                      dates={{ start: preferences.startDate, end: preferences.endDate }}
                      travelers={preferences.travelers}
                      budget={preferences.budget}
                      origin={preferences.comingFrom}
                      refreshKey={bookingRefreshKey}
                    />
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <TravelHistory
              userId={userId}
              onSelectPlan={handleHistoryPlanSelect}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}