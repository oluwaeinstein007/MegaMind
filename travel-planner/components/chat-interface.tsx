'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Bot, 
  User, 
  Loader2,
  MessageSquare,
  Sparkles,
  Calendar,
  MapPin,
  DollarSign,
  HelpCircle,
  Edit3,
  Info,
  Search,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[];
  interactionType?: 'question' | 'modification';
  sources?: string[];
  webSearched?: boolean;
}

interface ChatInterfaceProps {
  planId: string;
  initialData: any;
  onPlanUpdate?: (updatedPlan: any) => void;
  onBookingRefresh?: () => void;
}

export function ChatInterface({ planId, initialData, onPlanUpdate, onBookingRefresh }: ChatInterfaceProps) {
  console.log('🗣️ ChatInterface initialized with:', { planId, initialData: !!initialData, onPlanUpdate: !!onPlanUpdate });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hey there! 👋 I'm **Luna**, your personal travel companion! I'm super excited to help you plan your trip to **${initialData?.itinerary?.destination || 'your destination'}**.

Here's what I can do for you:

🔍 **Search the web** for the latest recommendations, TikTok trends, Reddit tips, and hidden gems
📝 **Answer questions** about your itinerary, costs, timing, and local tips
✨ **Make changes** to customize your trip exactly how you want it
🎯 **Give personalized recommendations** based on what I know about the destination

**Try asking me things like:**
- "What's the best coffee shop locals love?"
- "Find me a hidden gem restaurant on TikTok"
- "What should I know about local customs?"
- "Add a sunset cruise to day 2"

What would you like to explore first?`,
      timestamp: Date.now(),
      suggestions: [
        '🔥 What\'s trending on TikTok for this destination?',
        '🌟 Show me the hidden gems locals love',
        '💰 How can I save money on this trip?',
        '🍴 Find the best local food spots',
        '📸 Most Instagram-worthy places to visit'
      ]
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-with-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          message: content,
          currentPlan: initialData,
          chatHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const result = await response.json();

      // Create assistant response message with sources
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response,
        timestamp: Date.now(),
        suggestions: result.suggestions,
        interactionType: result.interactionType,
        sources: result.sources,
        webSearched: result.webSearched
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show toast if web was searched
      if (result.webSearched) {
        toast.info('🔍 Searched the web for the latest info!', { duration: 2000 });
      }

      // Handle different interaction types
      if (result.interactionType === 'modification' && result.updatedPlan && onPlanUpdate) {
        console.log('🔄 Sending plan update to parent:', result.updatedPlan);
        onPlanUpdate(result.updatedPlan);
        toast.success('Travel plan updated successfully! Check the Itinerary tab to see changes.');

        // Trigger booking refresh so recommendations stay in sync
        if (onBookingRefresh) {
          console.log('🔄 Triggering booking refresh after modification');
          onBookingRefresh();
        }
        
        // Add a visual indicator message for modifications
        const updateNotification: ChatMessage = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '✅ **Itinerary Modified!** Your travel plan has been updated. Switch to the Itinerary tab to see the changes.',
          timestamp: Date.now(),
          interactionType: 'modification'
        };
        
        setTimeout(() => {
          setMessages(prev => [...prev, updateNotification]);
        }, 1000);
      } else if (result.interactionType === 'question') {
        console.log('💬 Question answered about the itinerary');
        // You can add additional logic here for question-specific handling
      } else {
        console.log('ℹ️ No plan update needed or no callback provided');
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Luna
          </span>
          <span className="text-sm font-normal text-gray-600 dark:text-gray-400">Your Travel Companion</span>
          <Badge variant="outline" className="ml-auto bg-white/50 dark:bg-gray-800/50">
            <Globe className="w-3 h-3 mr-1" />
            Live Search
          </Badge>
        </CardTitle>
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary" className="flex items-center gap-1 bg-white/70 dark:bg-gray-800/70">
            <Search className="w-3 h-3" />
            Web + Social
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1 bg-white/70 dark:bg-gray-800/70">
            <HelpCircle className="w-3 h-3" />
            Q&A
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1 bg-white/70 dark:bg-gray-800/70">
            <Edit3 className="w-3 h-3" />
            Modify
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
          <div className="space-y-4 pb-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarFallback className="bg-blue-100 text-blue-600">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-1' : ''}`}>
                    {/* Add interaction type indicator for assistant messages */}
                    {message.role === 'assistant' && (message.interactionType || message.webSearched) && (
                      <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                        {message.webSearched && (
                          <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                            <Search className="w-3 h-3" />
                            Searched the web
                          </span>
                        )}
                        {message.interactionType === 'question' && (
                          <span className="flex items-center gap-1">
                            <HelpCircle className="w-3 h-3" />
                            Information
                          </span>
                        )}
                        {message.interactionType === 'modification' && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Edit3 className="w-3 h-3" />
                            Modification Applied
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className={`rounded-lg p-3 ${
                      message.role === 'user' 
                        ? 'bg-blue-600 text-white ml-auto' 
                        : message.interactionType === 'modification'
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : message.webSearched
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800'
                            : 'bg-gray-100 dark:bg-gray-800'
                    }`}>
                      {message.role === 'assistant' ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm dark:prose-invert max-w-none"
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                    
                    {/* Display sources if available */}
                    {message.sources && message.sources.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                          📚 View {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                        </summary>
                        <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                          {message.sources.slice(0, 5).map((source, index) => (
                            <a
                              key={index}
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-blue-600 dark:text-blue-400 hover:underline truncate"
                            >
                              {new URL(source).hostname.replace('www.', '')}
                            </a>
                          ))}
                        </div>
                      </details>
                    )}
                    
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => handleSuggestionClick(suggestion)}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {message.role === 'user' && (
                    <Avatar className="w-8 h-8 mt-1">
                      <AvatarFallback className="bg-green-100 text-green-600">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <Avatar className="w-8 h-8 mt-1">
                  <AvatarFallback className="bg-blue-100 text-blue-600 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Analyzing your request
                    </span>
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>
        
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask questions or request changes to your travel plan..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              onClick={() => handleSendMessage(input)}
              disabled={isLoading || !input.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSendMessage('What\'s the total cost breakdown?')}
            >
              <HelpCircle className="w-3 h-3 mr-1" />
              Cost Info
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSendMessage('What activities are planned for each day?')}
            >
              <Info className="w-3 h-3 mr-1" />
              Daily Plans
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSendMessage('Add more budget-friendly options')}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Budget Options
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleSendMessage('Add cultural activities to day 2')}
            >
              <Calendar className="w-3 h-3 mr-1" />
              Add Activities
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}