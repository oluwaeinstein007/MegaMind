'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Users,
  Eye,
  Trash2,
  Download,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TravelHistoryItem {
  id: string;
  preferences: any;
  result: any;
  createdAt: number;
}

interface TravelHistoryProps {
  userId: string;
  onSelectPlan?: (plan: TravelHistoryItem) => void;
}

export function TravelHistory({ userId, onSelectPlan }: TravelHistoryProps) {
  const [history, setHistory] = useState<TravelHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/user-history?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('Failed to load travel history');
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      const response = await fetch(`/api/user-history/${planId}?userId=${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setHistory(prev => prev.filter(item => item.id !== planId));
        toast.success('Travel plan deleted');
      } else {
        throw new Error('Failed to delete plan');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete travel plan');
    }
  };

  const downloadPlan = async (plan: TravelHistoryItem) => {
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: plan.preferences,
          recommendations: plan.result.recommendations,
          itinerary: plan.result.itinerary,
          workflowData: plan.result.workflow_data
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `travel-plan-${plan.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF downloaded successfully!');
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download PDF');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Travel History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          Travel History
          <Badge variant="outline" className="ml-auto">
            {history.length} plans
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No travel plans yet</p>
            <p className="text-sm text-gray-400">Your travel history will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              <AnimatePresence>
                {history.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg mb-1">
                              {item.result?.itinerary?.destination || item.preferences?.destination || 'Unknown Destination'}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Created {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.result?.orchestration?.agents_executed?.length && (
                              <Badge variant="outline" className="text-xs">
                                <Star className="w-3 h-3 mr-1" />
                                AI Generated
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-500" />
                            <span className="truncate">{item.preferences?.destination}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-500" />
                            <span>{item.preferences?.startDate}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-gray-500" />
                            <span className="capitalize">{item.preferences?.budget}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-500" />
                            <span>{item.preferences?.travelers}</span>
                          </div>
                        </div>
                        
                        {item.result?.orchestration && (
                          <div className="flex gap-2 mb-3 text-xs">
                            <Badge variant="secondary">
                              {item.result.orchestration.steps} steps
                            </Badge>
                            <Badge variant="secondary">
                              {item.result.orchestration.tool_calls} tool calls
                            </Badge>
                            <Badge variant="secondary">
                              {item.result.orchestration.agents_executed?.length || 0} agents
                            </Badge>
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => onSelectPlan?.(item)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => downloadPlan(item)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            PDF
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deletePlan(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}