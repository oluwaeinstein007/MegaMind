import { CitySelector } from './agents/city-selector';
import { LocalExpert } from './agents/local-expert';
import { TravelConcierge } from './agents/travel-concierge';
import { TavilySearchTool } from './tools/tavily-search';
import { BookingCurator } from './agents/booking-curator';
import { CalculateTool } from './tools/calculate';

// Define BookingPlace type if not imported from elsewhere
type BookingPlace = {
  type: string;
  [key: string]: any;
};

export interface AgentMessage {
  role: 'user' | 'assistant' | 'tool';
  content: any;
  agent?: string;
  toolCalls?: any[];
  timestamp?: number;
}

export interface AgentState {
  messages: AgentMessage[];
  currentAgent: string;
  step: number;
  data: Record<string, any>;
  toolCalls: any[];
  isComplete: boolean;
  finalAnswer?: any;
  preferences?: any;
}

export interface WorkflowConfig {
  recursionLimit: number;
  timeout: number;
  enableTools: boolean;
}

export class StateGraph {
  private agents: Map<string, any>;
  private tools: Map<string, any>;
  private config: WorkflowConfig;
  private routingRules: Map<string, (state: AgentState) => string>;

  constructor(config: WorkflowConfig = {
    recursionLimit: 150,
    timeout: 300000, // 5 minutes
    enableTools: true
  }) {
    this.config = config;
    this.agents = new Map();
    this.tools = new Map();
    this.routingRules = new Map();
    
    this.initializeAgents();
    this.initializeTools();
    this.setupRouting();
  }

  private initializeAgents() {
    this.agents.set('city-selector', new CitySelector());
    this.agents.set('local-expert', new LocalExpert());
    this.agents.set('travel-concierge', new TravelConcierge());
    this.agents.set('booking-curator', new BookingCurator()); 
  }

  private initializeTools() {
    if (this.config.enableTools) {
      this.tools.set('tavily-search', new TavilySearchTool());
      this.tools.set('calculate', new CalculateTool());
    }
  }

  private setupRouting() {
    // Define routing logic between agents
    this.routingRules.set('city-selector', (state: AgentState) => {
      if (state.data['city-selector']?.selectedCity) {
        return 'local-expert';
      }
      return 'city-selector'; // Stay if not complete
    });

    this.routingRules.set('local-expert', (state: AgentState) => {
      if (state.data['local-expert']?.insights) {
        return 'travel-concierge';
      }
      return 'local-expert'; // Stay if not complete
    });

    // this.routingRules.set('travel-concierge', (state: AgentState) => {

    //   // Travel concierge is the final agent
      
    // });
    this.routingRules.set('travel-concierge', (state) => 'booking-curator');
    this.routingRules.set('booking-curator',  () => 'END');
  }

  async execute(input: any, startAgent: string = 'city-selector'): Promise<AgentState> {
    const state: AgentState = {
      messages: [{ 
        role: 'user', 
        content: input,
        timestamp: Date.now()
      }],
      currentAgent: startAgent,
      step: 0,
      data: {},
      toolCalls: [],
      isComplete: false,
      preferences: input
    };

    const startTime = Date.now();
    
    try {
      while (!state.isComplete && state.step < this.config.recursionLimit) {
        // Check timeout
        if (Date.now() - startTime > this.config.timeout) {
          throw new Error('Workflow timeout exceeded');
        }

        console.log(`StateGraph: Executing step ${state.step} with agent ${state.currentAgent}`);
        
        await this.executeStep(state);
        state.step++;

        // Check for completion
        if (state.currentAgent === 'END' || state.isComplete) {
          state.isComplete = true;
          break;
        }
      }

      if (!state.isComplete && state.step >= this.config.recursionLimit) {
        throw new Error('Workflow exceeded recursion limit');
      }

      return state;
    } catch (error) {
      console.error('StateGraph execution error:', error);
      throw error;
    }
  }

  private async executeStep(state: AgentState): Promise<void> {
    const agent = this.agents.get(state.currentAgent);
    
    if (!agent) {
      throw new Error(`Agent not found: ${state.currentAgent}`);
    }

    try {
      // Execute current agent
      const agentResponse = await this.executeAgent(state.currentAgent, state);
      
      // Process tool calls if present
      if (agentResponse.toolCalls && agentResponse.toolCalls.length > 0) {
        console.log(`StateGraph: Executing ${agentResponse.toolCalls.length} tool calls`);
        const toolResults = await this.executeTools(agentResponse.toolCalls);
        state.toolCalls.push(...toolResults);
        
        // Add tool results to messages
        state.messages.push({
          role: 'tool',
          content: toolResults,
          agent: state.currentAgent,
          timestamp: Date.now()
        });
      }

      // Store agent results
      state.data[state.currentAgent] = agentResponse.data;
      
      // Add agent response to messages
      state.messages.push({
        role: 'assistant',
        content: agentResponse.content,
        agent: state.currentAgent,
        timestamp: Date.now()
      });

      // Check for final answer
      if (agentResponse.content?.includes('FINAL ANSWER') || agentResponse.isComplete) {
        state.isComplete = true;
        state.finalAnswer = agentResponse.data;
        return;
      }

      // Route to next agent
      const nextAgent = this.routeToNextAgent(state.currentAgent, state);
      console.log(`StateGraph: Routing from ${state.currentAgent} to ${nextAgent}`);
      state.currentAgent = nextAgent;

    } catch (error) {
      console.error(`StateGraph: Error executing agent ${state.currentAgent}:`, error);
      throw error;
    }
  }

  private async executeAgent(agentName: string, state: AgentState): Promise<any> {
    const agent = this.agents.get(agentName);
    
    switch (agentName) {
      case 'city-selector':
        console.log('StateGraph: Executing City Selector Agent');
        const cityAnalysis = await agent.analyze(state.preferences);
        return {
          content: `City analysis complete. Selected: ${cityAnalysis.selectedCity}`,
          data: cityAnalysis,
          toolCalls: cityAnalysis.searchQuery ? [
            {
              tool: 'tavily-search',
              query: cityAnalysis.searchQuery,
              type: 'destination_search'
            }
          ] : []
        };

      case 'local-expert':
        console.log('StateGraph: Executing Local Expert Agent');
        const selectedCity = state.data['city-selector']?.selectedCity || 'Unknown City';
        const interests = state.preferences?.interests || '';
        const localAnalysis = await agent.analyze(selectedCity, interests);
        return {
          content: `Local expert analysis complete for ${selectedCity}`,
          data: localAnalysis,
          toolCalls: localAnalysis.searchQueries?.map((query: string) => ({
            tool: 'tavily-search',
            query,
            type: 'local_search'
          })) || []
        };

      case 'travel-concierge':
        console.log('StateGraph: Executing Travel Concierge Agent');
        const cityData = state.data['city-selector'];
        const localData = state.data['local-expert'];
        
        const itinerary = await agent.createItinerary(
          cityData?.selectedCity || 'Unknown City',
          localData?.insights || [],
          state.preferences?.startDate,
          state.preferences?.endDate,
          state.preferences?.travelers,
          state.preferences?.budget
        );
        
        return {
          content: 'FINAL ANSWER - Complete travel itinerary generated',
          data: itinerary,
          isComplete: true,
          toolCalls: [
            {
              tool: 'calculate',
              expression: `budget analysis for ${itinerary.totalBudget?.amount || '0'}`,
              type: 'budget_calculation'
            }
          ]
        };

      case 'booking-curator': {
        const { selectedCity } = state.data['city-selector'];
        const { budget }       = state.preferences;
        const interests        = state.preferences?.interests ?? '';
        const places = await agent.curate(selectedCity, budget, interests);

        // merge curated places into existing itinerary
        const trip = state.data['travel-concierge'];
        trip.bookingInfo.hotels      = places.curated.filter((p: BookingPlace) => p.type === 'hotel');
        trip.bookingInfo.restaurants = places.curated.filter((p: BookingPlace) => p.type === 'restaurant');
        trip.bookingInfo.activities  = [
          ...(trip.bookingInfo.activities as BookingPlace[]),
          ...places.curated.filter((p: BookingPlace) => p.type === 'activity')
        ];

        return {
          content: 'FINAL ANSWER – curated bookings added',
          data:   trip,
          isComplete: true
        };
      }

      default:
        throw new Error(`Unknown agent: ${agentName}`);
    }
  }

  private async executeTools(toolCalls: any[]): Promise<any[]> {
    const results = [];
    
    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.tool);
      
      if (!tool) {
        console.warn(`StateGraph: Tool not found: ${toolCall.tool}`);
        results.push({
          tool: toolCall.tool,
          input: toolCall,
          error: `Tool ${toolCall.tool} not available`
        });
        continue;
      }

      try {
        let result;
        
        switch (toolCall.tool) {
          case 'tavily-search':
            console.log(`StateGraph: Executing Tavily search for: ${toolCall.query}`);
            result = await tool.search(toolCall.query);
            break;
          case 'calculate':
            console.log(`StateGraph: Executing calculation: ${toolCall.expression}`);
            result = tool.calculate(toolCall.expression);
            break;
          default:
            console.warn(`StateGraph: Unknown tool: ${toolCall.tool}`);
            continue;
        }

        results.push({
          tool: toolCall.tool,
          input: toolCall,
          output: result,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error(`StateGraph: Tool execution error (${toolCall.tool}):`, error);
        results.push({
          tool: toolCall.tool,
          input: toolCall,
          error: error instanceof Error ? error.message : 'Unknown tool error',
          timestamp: Date.now()
        });
      }
    }

    return results;
  }

  private routeToNextAgent(currentAgent: string, state: AgentState): string {
    const routingFunction = this.routingRules.get(currentAgent);
    
    if (routingFunction) {
      return routingFunction(state);
    }

    // Default routing fallback
    const defaultRouting: Record<string, string> = {
      'city-selector': 'local-expert',
      'local-expert': 'travel-concierge',
      'travel-concierge': 'END'
    };

    return defaultRouting[currentAgent] || 'END';
  }

  // Add conditional routing based on state
  addConditionalEdge(
    fromAgent: string,
    condition: (state: AgentState) => boolean,
    toAgent: string,
    elseAgent?: string
  ) {
    this.routingRules.set(fromAgent, (state: AgentState) => {
      return condition(state) ? toAgent : (elseAgent || fromAgent);
    });
  }

  // Add custom agent
  addAgent(name: string, agent: any) {
    this.agents.set(name, agent);
    console.log(`StateGraph: Added custom agent: ${name}`);
  }

  // Add custom tool
  addTool(name: string, tool: any) {
    this.tools.set(name, tool);
    console.log(`StateGraph: Added custom tool: ${name}`);
  }

  // Get current state snapshot
  getState(): { agents: string[], tools: string[], config: WorkflowConfig } {
    return {
      agents: Array.from(this.agents.keys()),
      tools: Array.from(this.tools.keys()),
      config: this.config
    };
  }
}