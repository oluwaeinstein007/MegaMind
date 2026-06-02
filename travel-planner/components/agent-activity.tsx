'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Search, 
  Plane, 
  Bot,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AgentState {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'completed' | 'error';
  progress: number;
  lastActivity: string;
  results?: any;
}

interface AgentActivityProps {
  agent: AgentState;
}

export function AgentActivity({ agent }: AgentActivityProps) {
  const getAgentIcon = (agentId: string) => {
    switch (agentId) {
      case 'city-selector':
        return <MapPin className="w-4 h-4" />;
      case 'local-expert':
        return <Search className="w-4 h-4" />;
      case 'travel-concierge':
        return <Plane className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-gray-500" />;
      case 'active':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-gray-100 text-gray-700';
      case 'active':
        return 'bg-blue-100 text-blue-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'error':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getCardBorder = (status: string) => {
    switch (status) {
      case 'active':
        return 'border-blue-300 shadow-blue-100';
      case 'completed':
        return 'border-green-300 shadow-green-100';
      case 'error':
        return 'border-red-300 shadow-red-100';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <Card className={`transition-all duration-300 ${getCardBorder(agent.status)}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getAgentIcon(agent.id)}
            <span className="font-medium text-sm">{agent.name}</span>
          </div>
          {getStatusIcon(agent.status)}
        </div>
        
        <Badge 
          variant="secondary" 
          className={`mb-3 ${getStatusColor(agent.status)}`}
        >
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </Badge>
        
        {agent.status === 'active' && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span>Progress</span>
              <span>{Math.round(agent.progress)}%</span>
            </div>
            <Progress value={agent.progress} className="h-1" />
          </div>
        )}
        
        <p className="text-xs text-gray-600 leading-relaxed">
          {agent.lastActivity}
        </p>
      </CardContent>
    </Card>
  );
}