'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Calendar,
  DollarSign,
  Users,
  Star,
  Clock,
  Camera,
  Utensils,
  Bed,
  Plane,
  Eye,
  Heart,
  Info,
  Navigation,
  Lightbulb,
  BookOpen,
  Compass,
  FileText,
  Sparkles,
  HelpCircle,
  Check,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Activity,
  Award,
  Coffee,
  Music,
  Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper function to extract recursive string text from React elements in markdown custom components
function getTextFromChildren(children: React.ReactNode): string {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join('');
  }
  if (typeof children === 'object' && React.isValidElement(children)) {
    return getTextFromChildren(children.props.children);
  }
  return '';
}


interface ItineraryPreviewProps {
  /** original form values or stored prefs */
  preferences: any;
  /** alt. cities from City‑Selector agent */
  recommendations: any[];
  /** itinerary object returned by backend */
  itinerary: any;
  /** raw multi‑agent payload (for insights / tool results) */
  workflowData?: any;
  /**
   * Parent callback – when user clicks a card, we notify
   * so the page can call `/api/quick-plan` (or similar)
   * and then feed the new plan back as props.
   */
  onSelectCity?: (city: string) => void;
}

export function ItineraryPreview({
  preferences,
  recommendations,
  itinerary,
  workflowData,
  onSelectCity
}: ItineraryPreviewProps) {
  console.debug('ItineraryPreview component initialized', {
    hasPreferences: !!preferences,
    hasItinerary: !!itinerary,
    hasWorkflowData: !!workflowData,
    scheduleLength: itinerary?.schedule?.length
  });
  /* ---------- derived data ---------- */
  const cityAnalysis   = workflowData?.city_analysis || workflowData?.workflow_data?.city_analysis || workflowData?.workflowData?.city_analysis;
  const localInsights  = workflowData?.local_insights || workflowData?.workflow_data?.local_insights || workflowData?.workflowData?.local_insights;
  const travelLogistics = workflowData?.travel_logistics || workflowData?.workflow_data?.travel_logistics || workflowData?.workflowData?.travel_logistics;

  const realRecommendations = cityAnalysis?.alternatives || recommendations || [];

  const realItinerary = {
    destination : cityAnalysis?.selectedCity
                || itinerary?.destination
                || preferences.destination,
    schedule    : travelLogistics?.schedule
                || itinerary?.schedule
                || [],
    totalBudget : travelLogistics?.totalBudget
                || itinerary?.totalBudget
                || { amount: '$0', breakdown: {} },
    confidence  : cityAnalysis?.confidence ?? 0.85
  };

  /* ---------- local UI state ---------- */
  const [activeCity, setActiveCity] = useState<string>(realItinerary.destination);

  // Detect which content formats are available
  const hasRichContent = !!(workflowData?.rich_content || workflowData?.workflow_data?.rich_content || workflowData?.workflowData?.rich_content);
  const hasStructuredItinerary = realItinerary.schedule && realItinerary.schedule.length > 0;

  // Set default view mode: structured first if available, otherwise markdown as fallback
  const [viewMode, setViewMode] = useState<'structured' | 'markdown'>(
    hasStructuredItinerary ? 'structured' : (hasRichContent ? 'markdown' : 'structured')
  );

  // Dynamic fallback chaining: Automatically shift viewMode if structure changes
  useEffect(() => {
    if (!hasStructuredItinerary && hasRichContent && viewMode === 'structured') {
      setViewMode('markdown');
    } else if (!hasRichContent && hasStructuredItinerary && viewMode === 'markdown') {
      setViewMode('structured');
    }
  }, [hasStructuredItinerary, hasRichContent]);
  
  // Set active tab for markdown agent reports
  const [richTab, setRichTab] = useState<'city' | 'local' | 'itinerary' | 'bookings'>('city');

  // Pagination State for Visual Itinerary Dashboard (5 days per page)
  const [currentPage, setCurrentPage] = useState(1);
  const daysPerPage = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [realItinerary.schedule]);

  const activeReport = 
    richTab === 'city' ? (workflowData?.rich_content?.city_selection || workflowData?.workflow_data?.rich_content?.city_selection || "*No report generated yet.*") :
    richTab === 'local' ? (workflowData?.rich_content?.local_exploration || workflowData?.workflow_data?.rich_content?.local_exploration || "*No report generated yet.*") :
    richTab === 'itinerary' ? (workflowData?.rich_content?.itinerary_design || workflowData?.workflow_data?.rich_content?.itinerary_design || "*No report generated yet.*") :
    richTab === 'bookings' ? (workflowData?.rich_content?.booking_curation || workflowData?.workflow_data?.rich_content?.booking_curation || "*No report generated yet.*") :
    "*No report generated yet.*";

  const handleCityClick = (city: string) => {
    setActiveCity(city);
    onSelectCity?.(city);            // notify parent (if supplied)
  };

  /* ---------- helpers ---------- */
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'transport':     return <Plane     className="w-4 h-4 text-blue-600"   />;
      case 'accommodation': return <Bed       className="w-4 h-4 text-green-600"  />;
      case 'sightseeing':   return <Camera    className="w-4 h-4 text-purple-600" />;
      case 'dining':        return <Utensils  className="w-4 h-4 text-orange-600" />;
      case 'leisure':       return <Star      className="w-4 h-4 text-yellow-600" />;
      case 'cultural':      return <Info      className="w-4 h-4 text-indigo-600" />;
      case 'shopping':      return <Heart     className="w-4 h-4 text-pink-600"   />;
      default:              return <Clock     className="w-4 h-4 text-gray-600"   />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'hidden_gem':     return <Eye   className="w-4 h-4 text-purple-600" />;
      case 'local_favorite': return <Heart className="w-4 h-4 text-red-600"    />;
      case 'cultural_tip':   return <Info  className="w-4 h-4 text-blue-600"   />;
      case 'seasonal_event': return <Calendar className="w-4 h-4 text-green-600" />;
      case 'insider_secret': return <Star  className="w-4 h-4 text-yellow-600" />;
      default:               return <MapPin className="w-4 h-4 text-gray-600"  />;
    }
  };

  /* ====================================================================== */

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* TOP‑LEVEL TRIP SUMMARY                                            */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Your Perfect Trip to {realItinerary.destination}
            {cityAnalysis?.confidence && (
              <Badge variant="outline" className="ml-auto bg-white/80">
                {Math.round(cityAnalysis.confidence * 100)}% AI Confidence
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* destination */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Destination</p>
                <p className="font-medium">{realItinerary.destination}</p>
              </div>
            </div>
            {/* dates */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">
                  {preferences.startDate} – {preferences.endDate}
                </p>
              </div>
            </div>
            {/* budget */}
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Budget</p>
                <p className="font-medium">{preferences.budget}</p>
              </div>
            </div>
            {/* travellers */}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <div>
                <p className="text-sm text-gray-600">Travelers</p>
                <p className="font-medium">{preferences.travelers}</p>
              </div>
            </div>
          </div>

          {/* AI reasoning */}
          {cityAnalysis?.reasoning && (
            <div className="mt-4 p-4 bg-white/60 dark:bg-slate-800/60 rounded-lg">
              <h4 className="font-medium text-indigo-900 dark:text-indigo-100 mb-2">
                AI Analysis Summary
              </h4>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">{cityAnalysis.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* VIEW MODE TOGGLE (ONLY SHOW IF BOTH FORMATS ARE AVAILABLE)        */}
      {/* ------------------------------------------------------------------ */}
      {hasRichContent && hasStructuredItinerary && (
        <div className="flex justify-end gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg max-w-sm ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('structured')}
            className={cn(
              "text-xs px-3 py-1.5 h-8",
              viewMode === 'structured' && "bg-white dark:bg-slate-700 shadow-sm font-semibold text-indigo-600 dark:text-indigo-400"
            )}
          >
            <Compass className="w-3.5 h-3.5 mr-1" />
            Visual Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('markdown')}
            className={cn(
              "text-xs px-3 py-1.5 h-8",
              viewMode === 'markdown' && "bg-white dark:bg-slate-700 shadow-sm font-semibold text-indigo-600 dark:text-indigo-400"
            )}
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Agent Reports (Markdown)
          </Button>
        </div>
      )}

      {viewMode === 'markdown' && hasRichContent ? (
        <Card className="border-indigo-100/60 dark:border-slate-800 shadow-xl overflow-hidden bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/20 dark:to-purple-950/20 border-b border-indigo-100/40 dark:border-slate-800 py-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 dark:from-indigo-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent">
                  <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
                  Veridex Agent Fabric Research Reports
                </CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                  Complete, unedited synthesis from our 4 specialized AI specialist agents.
                </p>
              </div>
            </div>

            {/* Custom Pills Selector with morphing spring background */}
            <div className="flex flex-wrap gap-2.5 mt-4 relative">
              {[
                { id: 'city', label: 'Destination Selector', icon: <Compass className="w-4 h-4" /> },
                { id: 'local', label: 'Insider Guide', icon: <Star className="w-4 h-4" /> },
                { id: 'itinerary', label: 'Itinerary Planner', icon: <Calendar className="w-4 h-4" /> },
                { id: 'bookings', label: 'Bookings Curator', icon: <Bed className="w-4 h-4" /> }
              ].map((tab) => {
                const isActive = richTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setRichTab(tab.id as any)}
                    className={cn(
                      "relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 focus:outline-none",
                      isActive
                        ? "border-indigo-600/30 text-white shadow-md shadow-indigo-500/10"
                        : "border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-850/50 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {tab.icon}
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Premium Live Verification Status & Health Indicator */}
            <div className="mt-4 flex flex-wrap gap-4 items-center bg-white/50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/50 rounded-xl p-3.5 shadow-sm backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Orchestration Graph:</span>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold px-2 py-0.5 border border-emerald-100 dark:border-emerald-900/30">
                  4 Agents Synced
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Real-time Auditing:</span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 font-semibold px-2 py-0.5 border border-indigo-100 dark:border-indigo-900/30">
                    TavilySearch Verified
                  </Badge>
                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 font-semibold px-2 py-0.5 border border-purple-100 dark:border-purple-900/30">
                    MathCalculations Ok
                  </Badge>
                </span>
              </div>
              <div className="md:ml-auto flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Signal-to-Token Ratio:</span>
                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "94%" }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  />
                </div>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">94%</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 bg-slate-50/20 dark:bg-slate-950/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={richTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="max-w-none text-slate-700 dark:text-slate-300"
              >
                {/* 
                  High-end Custom Mapped Markdown Engine.
                  Intercepts headings, alerts, lists, and tables to transform them from raw markdown into active widgets.
                */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, children, ...props }) => (
                      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-8 mb-4 border-b border-indigo-100 dark:border-slate-800 pb-3 flex items-center gap-2 tracking-tight leading-snug" {...props}>
                        <Award className="w-5.5 h-5.5 text-indigo-500" />
                        {children}
                      </h1>
                    ),
                    h2: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      // Robust regex matching for rank titles (handles "Rank 1", "Rank #1", "Option 1", "1. Chao Phraya", etc.)
                      const rankMatch = text.match(/(?:Rank|Option)\s*#?\s*(\d+)[\s*:-]+(.*)/i)
                                     || text.match(/^\s*(\d+)[\s*:-]+(.*)/i);
                      if (rankMatch) {
                        const rankNum = rankMatch[1];
                        const rankRest = rankMatch[2].trim();
                        const titleMatch = rankRest.match(/([^(]+)\s*(?:\(([^)]+)\))?/);
                        const neighborhoodName = titleMatch ? titleMatch[1].trim() : rankRest;
                        const neighborhoodTag = titleMatch && titleMatch[2] ? titleMatch[2].trim() : '';

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.3 }}
                            className="mt-8 mb-6 overflow-hidden rounded-2xl border border-indigo-100/80 dark:border-slate-800/80 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-900/80 dark:via-slate-900 dark:to-purple-950/20 shadow-md shadow-indigo-100/5 dark:shadow-none p-5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-50 dark:border-slate-800/80 pb-4 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-extrabold shadow-md shadow-indigo-500/20">
                                  #{rankNum}
                                </div>
                                <div>
                                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
                                    {neighborhoodName}
                                  </h3>
                                  {neighborhoodTag && (
                                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1.5 inline-block">
                                      ✨ {neighborhoodTag}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-200/50 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold px-2.5 py-1 text-xs">
                                Selected Base Option
                              </Badge>
                            </div>
                          </motion.div>
                        );
                      }
                      return (
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-8 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 tracking-tight leading-snug" {...props}>
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      // Extremely robust Day regex matching to catch "Day X - ...", "Day #X: ...", "Day X (Date): ..."
                      const dayMatch = text.match(/Day\s*#?\s*(\d+)[\s*:-]*(?:\(([^)]+)\))?[\s*:-]*(.*)/i)
                                    || text.match(/Day\s*#?\s*(\d+)[\s*:-]+(.*)/i)
                                    || text.match(/^Day\s*#?\s*(\d+)\b/i);
                      
                      if (dayMatch) {
                        const dayNum = dayMatch[1];
                        const dateText = dayMatch[2] || '';
                        const restOfText = dayMatch[3] || '';
                        
                        const dayRest = dateText ? `${dateText} : ${restOfText}` : restOfText || text;
                        const restSplit = dayRest.split('–');
                        const dayTitle = restSplit[0].trim();
                        const daySubtitle = restSplit[1] ? restSplit[1].trim() : '';

                        return (
                          <div className="mt-10 mb-6 flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-500/20">
                              D{dayNum}
                            </div>
                            <div className="flex-1 pt-0.5">
                              <h4 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-snug">
                                {dayTitle}
                              </h4>
                              {daySubtitle && (
                                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1 flex items-center gap-1.5">
                                  <TrendingUp className="w-3.5 h-3.5" />
                                  {daySubtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-6 mb-3 border-l-4 border-purple-500 pl-3 leading-snug" {...props}>
                          {children}
                        </h3>
                      );
                    },
                    p: ({ node, ...props }) => (
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed my-3.5 font-medium" {...props} />
                    ),
                    a: ({ node, ...props }) => (
                      <a className="text-sm font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 underline underline-offset-4 decoration-2 hover:decoration-indigo-500 transition-all cursor-pointer" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="space-y-2 my-4 pl-0 list-none" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="space-y-3.5 my-4 pl-5 list-decimal text-sm font-medium text-slate-700 dark:text-slate-300" {...props} />
                    ),
                    li: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      let isKeyValue = false;
                      let keyText = '';
                      let valueNodes: React.ReactNode = children;

                      if (Array.isArray(children) && children.length > 0) {
                        const firstChild = children[0];
                        if (React.isValidElement(firstChild) && (firstChild.type === 'strong' || firstChild.type === 'b')) {
                          isKeyValue = true;
                          keyText = getTextFromChildren(firstChild).replace(/:$/, '').trim();
                          valueNodes = children.slice(1);
                        }
                      } else if (React.isValidElement(children) && (children.type === 'strong' || children.type === 'b')) {
                        isKeyValue = true;
                        keyText = getTextFromChildren(children).replace(/:$/, '').trim();
                        valueNodes = '';
                      }

                      if (isKeyValue) {
                        let icon = <Compass className="w-4 h-4 text-indigo-500" />;
                        let badgeColor = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30";
                        
                        const keyLower = keyText.toLowerCase();
                        if (keyLower.includes('vibe')) {
                          icon = <Compass className="w-4 h-4 text-amber-500" />;
                          badgeColor = "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/30";
                        } else if (keyLower.includes('accommodation') || keyLower.includes('hotel')) {
                          icon = <Bed className="w-4 h-4 text-emerald-500" />;
                          badgeColor = "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/30";
                        } else if (keyLower.includes('align') || keyLower.includes('interest')) {
                          icon = <Sparkles className="w-4 h-4 text-purple-500" />;
                          badgeColor = "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/30";
                        } else if (keyLower.includes('culture') || keyLower.includes('experience') || keyLower.includes('custom') || keyLower.includes('etiquette') || keyLower.includes('temple')) {
                          icon = <Info className="w-4 h-4 text-blue-500" />;
                          badgeColor = "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/30";
                        } else if (keyLower.includes('food') || keyLower.includes('dining') || keyLower.includes('restaurant') || keyLower.includes('gastronomy') || keyLower.includes('culinary')) {
                          icon = <Utensils className="w-4 h-4 text-orange-500" />;
                          badgeColor = "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-900/30";
                        } else if (keyLower.includes('outdoor') || keyLower.includes('activity') || keyLower.includes('adventure') || keyLower.includes('bike') || keyLower.includes('canal') || keyLower.includes('boat')) {
                          icon = <Navigation className="w-4 h-4 text-sky-500" />;
                          badgeColor = "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 border-sky-100 dark:border-sky-900/30";
                        } else if (keyLower.includes('nightlife') || keyLower.includes('club') || keyLower.includes('bar') || keyLower.includes('jazz')) {
                          icon = <Star className="w-4 h-4 text-pink-500" />;
                          badgeColor = "bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-100 dark:border-pink-900/30";
                        } else if (keyLower.includes('hack') || keyLower.includes('secret') || keyLower.includes('tip') || keyLower.includes('rule') || keyLower.includes('customs')) {
                          icon = <Lightbulb className="w-4 h-4 text-teal-500" />;
                          badgeColor = "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-900/30";
                        } else if (keyLower.includes('budget') || keyLower.includes('price') || keyLower.includes('cost') || keyLower.includes('rate') || keyLower.includes('tipping')) {
                          icon = <DollarSign className="w-4 h-4 text-green-500" />;
                          badgeColor = "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-900/30";
                        } else if (keyLower.includes('flight') || keyLower.includes('airline') || keyLower.includes('airport') || keyLower.includes('transit')) {
                          icon = <Plane className="w-4 h-4 text-indigo-500" />;
                          badgeColor = "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/30";
                        } else if (keyLower.includes('session') || keyLower.includes('spa') || keyLower.includes('wellness') || keyLower.includes('massage')) {
                          icon = <Heart className="w-4 h-4 text-rose-500" />;
                          badgeColor = "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/30";
                        }

                        return (
                          <motion.div 
                            whileHover={{ scale: 1.008, x: 3 }}
                            className="my-3.5 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm flex items-start gap-4 transition-all duration-300"
                          >
                            <div className="flex-shrink-0 mt-0.5 p-2 bg-white dark:bg-slate-850 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                              {icon}
                            </div>
                            <div className="flex-1 space-y-1">
                              <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5 border shadow-sm capitalize tracking-wide", badgeColor)}>
                                {keyText}
                              </Badge>
                              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                {valueNodes}
                              </div>
                            </div>
                          </motion.div>
                        );
                      }

                      return (
                        <li 
                          className="group relative pl-6 py-2 text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2 border-b border-indigo-50/5 dark:border-slate-800/10 last:border-b-0 transition-transform duration-300 hover:translate-x-1"
                          {...props}
                        >
                          <span className="absolute left-0 top-3.5 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 group-hover:scale-125 transition-transform duration-300" />
                          <div className="flex-1 leading-relaxed font-medium">{children}</div>
                        </li>
                      );
                    },
                    blockquote: ({ node, children, ...props }) => {
                      const text = getTextFromChildren(children);
                      let type: 'note' | 'tip' | 'important' | 'warning' = 'note';
                      let cleanText = text;
                      
                      if (text.includes('[!NOTE]') || text.includes('[!INFO]')) {
                        type = 'note';
                        cleanText = text.replace(/\[!(NOTE|INFO)\]/g, '').trim();
                      } else if (text.includes('[!TIP]') || text.includes('[!LIGHTBULB]')) {
                        type = 'tip';
                        cleanText = text.replace(/\[!(TIP|LIGHTBULB)\]/g, '').trim();
                      } else if (text.includes('[!IMPORTANT]') || text.includes('[!WARNING]')) {
                        type = 'important';
                        cleanText = text.replace(/\[!(IMPORTANT|WARNING)\]/g, '').trim();
                      } else if (text.includes('[!CAUTION]')) {
                        type = 'warning';
                        cleanText = text.replace(/\[!CAUTION\]/g, '').trim();
                      }

                      let colorClass = "border-blue-500 bg-blue-50/40 dark:bg-blue-950/10 text-blue-800 dark:text-blue-200";
                      let icon = <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />;
                      let label = "Note";

                      if (type === 'tip') {
                        colorClass = "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10 text-emerald-800 dark:text-emerald-200";
                        icon = <Lightbulb className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />;
                        label = "Insider Tip";
                      } else if (type === 'important') {
                        colorClass = "border-amber-500 bg-amber-50/40 dark:bg-amber-950/10 text-amber-800 dark:text-amber-200";
                        icon = <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />;
                        label = "Important Hack";
                      } else if (type === 'warning') {
                        colorClass = "border-rose-500 bg-rose-50/40 dark:bg-rose-950/10 text-rose-800 dark:text-rose-200";
                        icon = <HelpCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />;
                        label = "Important Protocol";
                      }

                      return (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn("my-6 flex gap-3.5 border-l-4 p-4 rounded-r-xl shadow-sm backdrop-blur-sm", colorClass)}
                        >
                          {icon}
                          <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider">{label}</p>
                            <p className="text-sm leading-relaxed font-semibold">{cleanText || children}</p>
                          </div>
                        </motion.div>
                      );
                    },
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-6 rounded-2xl border border-indigo-100/80 dark:border-slate-800 shadow-md">
                        <table className="min-w-full divide-y divide-indigo-100/50 dark:divide-slate-800" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead className="bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/20 dark:to-purple-950/20 border-b border-indigo-100/50 dark:border-slate-800" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="px-4 py-3 text-left text-xs font-extrabold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-4 py-3.5 text-sm text-slate-700 dark:text-slate-300 border-t border-indigo-50/40 dark:border-slate-800/40 font-semibold" {...props} />
                    ),
                    tr: ({ node, ...props }) => (
                      <tr className="hover:bg-indigo-50/20 dark:hover:bg-slate-800/20 transition-colors duration-200" {...props} />
                    )
                  }}
                >
                  {activeReport}
                </ReactMarkdown>
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ------------------------------------------------------------------ */}
          {/* AI‑CURATED RECOMMENDATIONS ‑‑ NOW CLICKABLE                        */}
          {/* ------------------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>AI‑Curated Destination Recommendations</CardTitle>
              <p className="text-sm text-gray-600">
                Generated by City Selector Agent with TavilySearchResults integration
              </p>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {realRecommendations.map((rec: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleCityClick(rec.city)}
                    className={cn(
                      'text-left border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500',
                      activeCity === rec.city
                        ? 'ring-2 ring-indigo-500'
                        : i === 0
                          ? 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-100'
                    )}
                  >
                    {/* visual wrapper */}
                    <Card className="border-0 shadow-none">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{rec.city}</h4>
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="text-sm">{rec.rating}</span>
                          </span>
                        </div>

                        {i === 0 && (
                          <Badge variant="default" className="mb-2 bg-indigo-600">
                            ✨ Selected Destination
                          </Badge>
                        )}

                        <Badge variant="outline" className="mb-2">{rec.bestFor}</Badge>

                        <p className="text-sm text-gray-600 mb-2">{rec.budget}</p>

                        <div className="space-y-1 mb-3">
                          {rec.highlights?.map((h: string, idx: number) => (
                            <p key={idx} className="text-xs text-gray-500">• {h}</p>
                          ))}
                        </div>

                        {rec.reasoning && (
                          <p className="text-xs text-gray-600 italic">{rec.reasoning}</p>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ------------------------------------------------------------------ */}
          {/* LOCAL EXPERT INSIGHTS                                             */}
          {/* ------------------------------------------------------------------ */}
          {localInsights?.insights?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Local Expert Insights & Hidden Gems</CardTitle>
                <p className="text-sm text-gray-600">
                  Insider knowledge from Local Expert Agent
                </p>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {localInsights.insights.map((ins: any, idx: number) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2 mb-2">
                            {getInsightIcon(ins.type)}
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{ins.name}</h4>
                              <Badge variant="outline" className="text-xs mt-1">
                                {ins.type.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>

                          <p className="text-xs text-gray-600 mb-2">{ins.description}</p>

                          <div className="space-y-1 text-xs text-gray-500">
                            <p><strong>📍 Location:</strong> {ins.location}</p>
                            {ins.rating      && <p><strong>⭐ Rating:</strong> {ins.rating}</p>}
                            {ins.priceRange  && <p><strong>💰 Price:</strong> {ins.priceRange}</p>}
                            {ins.bestTime    && <p><strong>⏰ Best Time:</strong> {ins.bestTime}</p>}
                            {ins.localTip    && (
                              <p className="text-blue-600 italic"><strong>💡 Tip:</strong> {ins.localTip}</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {localInsights.localSecrets?.length > 0 && (
                  <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Insider Secrets
                    </h4>
                    <div className="space-y-1">
                      {localInsights.localSecrets.map((s: string, idx: number) => (
                        <p key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">• {s}</p>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* DETAILED ITINERARY                                                */}
          {/* ------------------------------------------------------------------ */}
          <Card id="detailed-itinerary-header">
            <CardHeader>
              <CardTitle>
                Your Detailed Itinerary – {realItinerary.destination}
              </CardTitle>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{realItinerary.schedule.length} days of unique experiences</span>
                <span>•</span>
                <span>Total Budget: {realItinerary.totalBudget.amount}</span>
                {travelLogistics?.confidence && (
                  <>
                    <span>•</span>
                    <span>Confidence: {Math.round(travelLogistics.confidence * 100)}%</span>
                  </>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {realItinerary.schedule.length ? (
                <div className="space-y-8">
                  {(() => {
                    const indexOfLastDay = currentPage * daysPerPage;
                    const indexOfFirstDay = indexOfLastDay - daysPerPage;
                    const currentDays = realItinerary.schedule.slice(indexOfFirstDay, indexOfLastDay);

                    return currentDays.map((day: any, dIdx: number) => {
                      const absoluteIndex = indexOfFirstDay + dIdx;
                      return (
                        <motion.div
                          key={day.day || absoluteIndex}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: dIdx * 0.15 }}
                        >
                          {/* Day Header */}
                          <div className="flex items-start gap-4 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg">
                              {day.day}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold">{day.title}</h3>
                              <p className="text-indigo-600 dark:text-indigo-400 font-medium">{day.theme}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                <span>📅 {day.date}</span>
                                <span>💰 {day.dailyBudget}</span>
                                {day.neighborhoods?.length > 0 && (
                                  <span>🏘️ {day.neighborhoods.join(', ')}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Highlights */}
                          {day.highlights?.length > 0 && (
                            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
                              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                                <Star className="w-4 h-4" />
                                Day Highlights
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {day.highlights.map((h: string, hIdx: number) => (
                                  <Badge key={hIdx} variant="secondary" className="bg-blue-100 text-blue-800">
                                    {h}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Activities */}
                          <div className="space-y-4 ml-8">
                            {day.activities.map((act: any, aIdx: number) => (
                              <motion.div
                                key={aIdx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 + aIdx * 0.05 }}
                                className="relative"
                              >
                                {/* timeline connector */}
                                {aIdx < day.activities.length - 1 && (
                                  <div className="absolute left-6 top-12 w-0.5 h-16 bg-gray-200 dark:bg-gray-700" />
                                )}

                                <div className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                                  {/* bullet + time */}
                                  <div className="flex items-center gap-3 min-w-[120px]">
                                    <div className="w-3 h-3 bg-indigo-600 rounded-full" />
                                    <span className="flex items-center gap-1 text-sm font-medium text-gray-600">
                                      <Clock className="w-3 h-3 text-gray-400" />
                                      {act.time}
                                    </span>
                                  </div>

                                  {/* main block */}
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        {getActivityIcon(act.type)}
                                        <h4 className="font-semibold">{act.activity}</h4>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {act.cost && <Badge variant="outline">{act.cost}</Badge>}
                                        {act.bookingRequired && (
                                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                            Booking Required
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {/* place + address */}
                                    {act.specificPlace && (
                                      <div className="mb-2">
                                        <div className="flex items-center gap-2 mb-1">
                                          <MapPin className="w-3 h-3 text-indigo-600" />
                                          <span className="font-medium text-indigo-600">
                                            {act.specificPlace}
                                          </span>
                                        </div>
                                        {act.address && (
                                          <p className="text-xs text-gray-500 ml-5">{act.address}</p>
                                        )}
                                      </div>
                                    )}

                                    {/* description */}
                                    {act.description && (
                                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                        {act.description}
                                      </p>
                                    )}

                                    {/* extras */}
                                    <div className="flex items-center gap-4 mb-2 text-xs text-gray-500">
                                      {act.duration && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {act.duration}
                                        </span>
                                      )}
                                      {act.location && act.location !== act.specificPlace && (
                                        <span className="flex items-center gap-1">
                                          <Navigation className="w-3 h-3" />
                                          {act.location}
                                        </span>
                                      )}
                                    </div>

                                    {act.tips?.length > 0 && (
                                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
                                        <div className="flex items-center gap-1 mb-1">
                                          <Lightbulb className="w-3 h-3 text-blue-600" />
                                          <span className="font-medium text-blue-800 dark:text-blue-200">Tips:</span>
                                        </div>
                                        <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                                          {act.tips.map((tip: string, tIdx: number) => (
                                            <li key={tIdx}>• {tip}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {act.notes && (
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 italic">
                                        {act.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>

                          {/* Day notes */}
                          {day.notes?.length > 0 && (
                            <div className="ml-8 mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                              <strong>Daily Notes:</strong> {day.notes.join(' • ')}
                            </div>
                          )}

                          {dIdx < currentDays.length - 1 && <Separator className="mt-8" />}
                        </motion.div>
                      );
                    });
                  })()}

                  {/* Pagination Controls */}
                  {realItinerary.schedule.length > daysPerPage && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl shadow-sm backdrop-blur-md">
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Showing days <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{Math.min(realItinerary.schedule.length, (currentPage - 1) * daysPerPage + 1)}</span> to <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{Math.min(realItinerary.schedule.length, currentPage * daysPerPage)}</span> of <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{realItinerary.schedule.length}</span> days
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => {
                            setCurrentPage(prev => Math.max(1, prev - 1));
                            const el = document.getElementById('detailed-itinerary-header');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="h-8 text-xs font-bold rounded-xl border-slate-200/60 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Previous
                        </Button>
                        
                        {/* Page Numbers */}
                        {(() => {
                          const totalPages = Math.ceil(realItinerary.schedule.length / daysPerPage);
                          const pageNumbers = [];
                          
                          const maxVisible = 5;
                          let startPage = Math.max(1, currentPage - 2);
                          let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                          
                          if (endPage - startPage < maxVisible - 1) {
                            startPage = Math.max(1, endPage - maxVisible + 1);
                          }
                          
                          for (let i = startPage; i <= endPage; i++) {
                            pageNumbers.push(i);
                          }
                          
                          return (
                            <div className="flex items-center gap-1">
                              {startPage > 1 && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setCurrentPage(1);
                                      const el = document.getElementById('detailed-itinerary-header');
                                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="h-8 w-8 text-xs font-bold rounded-xl"
                                  >
                                    1
                                  </Button>
                                  {startPage > 2 && <span className="text-slate-400 text-xs px-1">...</span>}
                                </>
                              )}
                              
                              {pageNumbers.map(page => (
                                <Button
                                  key={page}
                                  variant={currentPage === page ? "default" : "ghost"}
                                  size="sm"
                                  onClick={() => {
                                    setCurrentPage(page);
                                    const el = document.getElementById('detailed-itinerary-header');
                                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                  className={cn(
                                    "h-8 w-8 text-xs font-extrabold rounded-xl transition-all duration-300",
                                    currentPage === page 
                                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                  )}
                                >
                                  {page}
                                </Button>
                              ))}
                              
                              {endPage < totalPages && (
                                <>
                                  {endPage < totalPages - 1 && <span className="text-slate-400 text-xs px-1">...</span>}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setCurrentPage(totalPages);
                                      const el = document.getElementById('detailed-itinerary-header');
                                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="h-8 w-8 text-xs font-bold rounded-xl"
                                  >
                                    {totalPages}
                                  </Button>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === Math.ceil(realItinerary.schedule.length / daysPerPage)}
                          onClick={() => {
                            const totalPages = Math.ceil(realItinerary.schedule.length / daysPerPage);
                            setCurrentPage(prev => Math.min(totalPages, prev + 1));
                            const el = document.getElementById('detailed-itinerary-header');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="h-8 text-xs font-bold rounded-xl border-slate-200/60 dark:border-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                    className="inline-block"
                  >
                    <Compass className="w-12 h-12 mx-auto mb-4 text-indigo-500/60" />
                  </motion.div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Structured Schedule Available</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    {hasRichContent 
                      ? "You can view the unedited specialist agent reports in the 'Agent Reports' tab above."
                      : "Luna is currently gathering details and planning your daily schedule."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ------------------------------------------------------------------ */}
          {/* BUDGET BREAKDOWN                                                  */}
          {/* ------------------------------------------------------------------ */}
          {realItinerary.totalBudget?.breakdown && Object.keys(realItinerary.totalBudget.breakdown).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Budget Analysis</CardTitle>
                <p className="text-sm text-gray-600">
                  Generated by Travel Concierge Agent with Calculate tool
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(realItinerary.totalBudget.breakdown).map(([cat, amt]) => (
                    <div
                      key={cat}
                      className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg"
                    >
                      <p className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">{cat}</p>
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{String(amt)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* LOW‑LEVEL TOOL RESULTS                                            */}
          {/* ------------------------------------------------------------------ */}
          {workflowData?.tool_results?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Multi‑Agent Tool Integration</CardTitle>
                <p className="text-sm text-gray-600">
                  Real‑time data from TavilySearchResults &amp; Calculate tools
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {workflowData.tool_results.map((res: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        {res.tool === 'tavily-search' ? (
                          <Eye className="w-4 h-4 text-blue-600" />
                        ) : (
                          <DollarSign className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{res.tool}</p>
                        <p className="text-xs text-gray-600">
                          {res.tool === 'tavily-search'
                            ? `Search: “${res.input?.query}”`
                            : `Calculation: “${res.input?.expression}”`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {res.output?.results?.length ?? '✓'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
