# Model Context Protocol (MCP) Integration Guide
## Connecting Flight, Hotel, and Booking Services to the Veridex Agent Fabric

This guide outlines the technical specification and implementation plan for integrating Model Context Protocol (MCP) servers into the Travel Planner application. It details how the native `@veridex/agents` framework connects to external travel APIs, exposes tools to agents, enforces security policy gates, and supports Human-in-the-Loop (HITL) dual approvals for transactional actions (like booking a flight or reserving a room).

---

## 1. High-Level Architecture & Communication Flow

The integration uses a **Client-Server MCP architecture** where the Next.js travel-planner server acts as the MCP client, establishing a secure stdio or SSE transport channel to local or remote travel MCP servers.

```
       ┌──────────────────────────────────────────────────────────┐
       │                 Next.js Frontend (React)                 │
       │     - Renders Dashboard, Itinerary, & Chat UI            │
       │     - Displays approvals modal for financial actions     │
       └───────────────────────────▲──────────────────────────────┘
                                   │ Event Bus (SSE / WebSocket)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Travel Planner Backend (Next.js App Router)               │
│                                                                        │
│  ┌───────────────────────┐   Verify    ┌────────────────────────────┐  │
│  │   OrchestratorEngine  ├────────────►│        PolicyEngine        │  │
│  │   (veridex orchestr)  │             │   - Evaluates proposals    │  │
│  └───────────┬───────────┘             │   - Flags financial class  │  │
│              │                         └─────────────┬──────────────┘  │
│              │                                       │ Verdict: Await  │
│              ▼                                       ▼                 │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │   MCP Client Manager  │             │     Approval Manager       │  │
│  │  (Connects & translates│             │  - Checkpoints state       │  │
│  │   schemas to Zod)     │             │  - Suspends runtime execution││
│  └───────────┬───────────┘             └────────────────────────────┘  │
└──────────────┼─────────────────────────────────────────────────────────┘
               │ stdio / SSE transport
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       MCP Travel Services Server                       │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │      MCP Router       │             │   Amadeus/Sabre Travel API │  │
│  │  - Exposes tool schema│◄───────────►│   - Flight Search Engine   │  │
│  │  - Dispatches calls   │             │   - Hotel GDS Gateway      │  │
│  └───────────────────────┘             └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Implementing the MCP Travel Server

This component runs as an independent microservice using `@modelcontextprotocol/sdk` to securely expose travel tools.

### 2.1 File Structure
```
mcp-travel-server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── schemas.ts
    └── services/
        ├── flights.ts
        ├── hotels.ts
        └── booking.ts
```

### 2.2 Server Source Code (`src/index.ts`)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Initialize the MCP Server
const server = new Server(
  {
    name: "veridex-travel-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool contracts
const TRAVEL_TOOLS: Tool[] = [
  {
    name: "fetch_flights",
    description: "Search for commercial flights between origin and destination for given dates. Returns itinerary details, times, airlines, and prices.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "3-letter airport code of origin (e.g., JFK)" },
        destination: { type: "string", description: "3-letter airport code of destination (e.g., NRT)" },
        departureDate: { type: "string", description: "Departure date in YYYY-MM-DD format" },
        returnDate: { type: "string", description: "Optional return date in YYYY-MM-DD format" },
        cabinClass: { type: "string", enum: ["economy", "premium_economy", "business", "first"], default: "economy" },
        travelersCount: { type: "number", default: 1 }
      },
      required: ["origin", "destination", "departureDate"]
    }
  },
  {
    name: "search_hotels",
    description: "Find lodging and hotel reservations in a destination city. Returns names, ratings, pricing, and availability.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "Destination city name (e.g. Tokyo)" },
        checkInDate: { type: "string", description: "Check-in date in YYYY-MM-DD format" },
        checkOutDate: { type: "string", description: "Check-out date in YYYY-MM-DD format" },
        roomsCount: { type: "number", default: 1 },
        budgetRange: { type: "string", enum: ["budget", "moderate", "luxury"], default: "moderate" }
      },
      required: ["city", "checkInDate", "checkOutDate"]
    }
  },
  {
    name: "book_trip",
    description: "CONSEQUENTIAL ACTION: Execute booking and lock pricing for selected flight and hotel options. Triggers real payment routing.",
    inputSchema: {
      type: "object",
      properties: {
        travelerName: { type: "string", description: "Primary traveler full legal name" },
        flightOfferId: { type: "string", description: "Unique identifier for the selected flight itinerary" },
        hotelOfferId: { type: "string", description: "Unique identifier for the selected hotel room option" },
        paymentMethodToken: { type: "string", description: "Secure token representing payment credentials" },
        totalPrice: { type: "number", description: "Agreed total amount to charge in USD" }
      },
      required: ["travelerName", "flightOfferId", "hotelOfferId", "totalPrice"]
    }
  }
];

// Handle listing tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TRAVEL_TOOLS,
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "fetch_flights": {
        const { origin, destination, departureDate, returnDate, cabinClass, travelersCount } = args as any;
        console.error(`[MCP Server] Querying flights from ${origin} to ${destination}...`);
        
        // Mock Amadeus/Sabre API invocation
        const flights = [
          { offerId: "fl-101", airline: "Japan Airlines", flightNum: "JL005", price: 1450, departure: "13:15", duration: "14h 10m" },
          { offerId: "fl-102", airline: "United Airlines", flightNum: "UA079", price: 1120, departure: "11:45", duration: "14h 35m" }
        ];
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, flights }) }],
        };
      }

      case "search_hotels": {
        const { city, checkInDate, checkOutDate, budgetRange } = args as any;
        console.error(`[MCP Server] Searching hotels in ${city} (Budget: ${budgetRange})...`);
        
        // Mock GDS Lodging lookup
        const hotels = [
          { offerId: "ht-901", name: "Aman Tokyo", rating: 5, pricePerNight: 1200, location: "Otemachi" },
          { offerId: "ht-902", name: "Park Hyatt Tokyo", rating: 5, pricePerNight: 850, location: "Shinjuku" }
        ];
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, hotels }) }],
        };
      }

      case "book_trip": {
        const { travelerName, flightOfferId, hotelOfferId, totalPrice } = args as any;
        console.error(`[MCP Server] Initiating booking for ${travelerName}: Flight=${flightOfferId}, Hotel=${hotelOfferId}`);
        
        // Mock gateway call
        const confirmationNumber = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              confirmationNumber,
              chargedAmount: totalPrice,
              status: "confirmed",
              message: "Flight and lodging successfully booked and paid."
            })
          }],
        };
      }

      default:
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error executing ${name}: ${error.message}` }],
    };
  }
});

// Start server on stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✈️ MCP Travel Server running on stdio transport");
```

---

## 3. Integrating the MCP Client with `@veridex/agents`

To integrate this server into Next.js, the backend starts a persistent child process connecting to the MCP Server via stdio and dynamically translates the JSON schema outputs into `@veridex/agents` compatible tool definitions.

### 3.1 Dynamic Client Wrapper (`lib/mcp-client-manager.ts`)

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool } from "@veridex/agents";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

export class MCPClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  async startClient(): Promise<Client> {
    if (this.client) return this.client;

    console.log("🔌 Connecting to MCP Travel Server...");
    
    // In production, reference the compiled JS path or absolute docker target
    const serverPath = path.resolve(process.cwd(), "mcp-travel-server/build/index.js");
    
    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath]
    });

    this.client = new Client({
      name: "travel-planner-mcp-client",
      version: "1.0.0"
    }, {
      capabilities: {}
    });

    await this.client.connect(this.transport);
    console.log("✅ Successfully connected to MCP Travel Server via stdio.");
    return this.client;
  }

  /**
   * Translates JSON schemas returned by the MCP server into typed Zod schemas
   * and registers them as native `@veridex/agents` tools.
   */
  async fetchAndRegisterTools(): Promise<any[]> {
    const client = await this.startClient();
    const { tools: mcpTools } = await client.listTools();

    return mcpTools.map((mcpTool) => {
      // Set appropriate safety classes based on naming or metadata
      let safetyClass: "read" | "write" | "network" | "financial" = "network";
      if (mcpTool.name.includes("book")) {
        safetyClass = "financial"; // Intercepted automatically by the policy gate
      } else if (mcpTool.name.includes("fetch") || mcpTool.name.includes("search")) {
        safetyClass = "network";
      }

      // Convert MCP JSON schema properties to Zod
      const zodShape: Record<string, z.ZodTypeAny> = {};
      const properties = (mcpTool.inputSchema as any).properties || {};
      const required = (mcpTool.inputSchema as any).required || [];

      for (const [key, propVal] of Object.entries(properties)) {
        let fieldSchema: z.ZodTypeAny = z.any();
        const p = propVal as any;

        if (p.type === "string") {
          if (p.enum) {
            fieldSchema = z.enum(p.enum as [string, ...string[]]);
          } else {
            fieldSchema = z.string();
          }
        } else if (p.type === "number") {
          fieldSchema = z.number();
        } else if (p.type === "boolean") {
          fieldSchema = z.boolean();
        }

        if (p.description) {
          fieldSchema = fieldSchema.describe(p.description);
        }

        if (!required.includes(key)) {
          fieldSchema = fieldSchema.optional();
        }

        zodShape[key] = fieldSchema;
      }

      // Return a native `@veridex/agents` tool
      return tool({
        name: mcpTool.name,
        description: mcpTool.description,
        input: z.object(zodShape),
        safetyClass,
        async execute({ input, context }) {
          console.log(`[MCP Bridge] Executing tool: ${mcpTool.name}`, input);
          
          const result = await client.callTool({
            name: mcpTool.name,
            arguments: input
          });

          const textContent = result.content?.[0] as any;
          return {
            success: !result.isError,
            llmOutput: textContent?.text || JSON.stringify(result)
          };
        }
      });
    });
  }

  async shutdown() {
    if (this.transport) {
      await this.transport.close();
      this.client = null;
      this.transport = null;
      console.log("🔌 Disconnected from MCP Travel Server.");
    }
  }
}
```

---

## 4. Safety & Security Policies (dual approvals)

Consequential actions (specifically tools marked with `safetyClass: "financial"`) should never execute automatically. The Veridex `PolicyEngine` enforces rule packs that intercept execution, issue state checkpoints, and suspend execution pending manual human-in-the-loop validation.

### 4.1 Configuring the Policy Gate (`lib/agents/policy-rules.ts`)

```typescript
import { PolicyEngine, Rule } from "@veridex/agents";

// Define a security rule pack
export const securityPolicyPack: Rule[] = [
  {
    name: "financial-escort",
    description: "Intercept all tool executions carrying the 'financial' safetyClass and demand multi-party manual approval.",
    priority: 100,
    async evaluate(proposal, context) {
      const { toolName, safetyClass } = proposal;

      if (safetyClass === "financial") {
        return {
          verdict: "escalate",
          reason: `Action '${toolName}' represents a commercial booking charge. Explicit user confirmation is required.`,
          metadata: {
            requiresRole: "primary-traveler",
            approvalMode: "dual_approval",
            escalationTimeoutMs: 600000 // 10 minutes
          }
        };
      }
      return { verdict: "allow" };
    }
  },
  {
    name: "restrictive-filesystem-access",
    description: "Prevent directory traversal and force sandbox isolation.",
    priority: 200,
    async evaluate(proposal) {
      if (proposal.type === "file_write" && proposal.path.includes("../")) {
        return { verdict: "deny", reason: "Directory traversal violation detected." };
      }
      return { verdict: "allow" };
    }
  }
];
```

---

## 5. Integrating with Next.js API Routes (`app/api/chat-with-plan/route.ts`)

When an agent proposes executing the `book_trip` tool:
1. The **PolicyEngine** triggers an `escalate` verdict.
2. The runtime halts, serializes the current execution state (including transaction identifiers), saves a checkpoint to Redis, and registers an `approval_requested` state in DB.
3. The API endpoint returns a `202 Accepted` status with a `runId` and the checkpoint metadata.
4. The client polls or listens to Server-Sent Events (SSE) and prompts the user for signature/verification.
5. On user approval, the client POSTs to `/api/approvals/resolve` to resume the run.

### 5.1 Handling Suspend/Resume in API Router (`app/api/chat-with-plan/route.ts`)

```typescript
import { NextResponse } from "next/server";
import { Orchestrator } from "@veridex/agents";
import { MCPClientManager } from "@/lib/mcp-client-manager";
import { securityPolicyPack } from "@/lib/agents/policy-rules";
import { CacheManager } from "@/lib/cache-manager";

const mcpManager = new MCPClientManager();

export async function POST(req: Request) {
  try {
    const { message, userId, runId, resumeApproval } = await req.json();

    // 1. Initialize MCP client and register dynamic tools
    const mcpTools = await mcpManager.fetchAndRegisterTools();

    // 2. Fetch existing checkpoint from Redis if resuming
    let initialCheckpoint = null;
    if (runId) {
      const savedState = await CacheManager.get(`run:${runId}:state`);
      if (savedState) {
        initialCheckpoint = JSON.parse(savedState);
      }
    }

    const orchestrator = new Orchestrator({
      team: {
        id: "travel-planning-team",
        name: "Travel Planner Team",
        members: [
          // Expose booking tools directly to the booking curator agent
          {
            definition: {
              id: "booking-curator-agent",
              name: "Booking Curator",
              tools: mcpTools
            },
            capabilities: ["booking-curation"]
          }
        ]
      },
      defaultRuntimeOptions: {
        enableTracing: true,
        enableCheckpoints: true,
        policies: securityPolicyPack
      }
    });

    // 3. If user approved the transaction, submit decision to the resume loop
    let runResult;
    if (resumeApproval && initialCheckpoint) {
      console.log(`[Orchestrator] Resuming suspended run: ${runId}`);
      runResult = await orchestrator.resume(runId, {
        checkpoint: initialCheckpoint,
        approvalResponse: {
          approved: true,
          inputValues: { paymentMethodToken: "tok_secure_client_token" }
        }
      });
    } else {
      console.log("[Orchestrator] Launching fresh planner pipeline");
      runResult = await orchestrator.run({
        input: message,
        userId
      });
    }

    // 4. Evaluate execution outcomes
    if (runResult.status === "suspended") {
      // Save checkpoint state to Redis
      await CacheManager.set(
        `run:${runResult.runId}:state`,
        JSON.stringify(runResult.checkpoint)
      );

      // Return a suspension payload to trigger the UI modal popup
      return NextResponse.json({
        status: "suspended",
        runId: runResult.runId,
        reason: runResult.suspensionReason,
        targetTool: runResult.escalatedAction?.toolName,
        price: runResult.escalatedAction?.arguments?.totalPrice
      });
    }

    return NextResponse.json({
      status: "completed",
      output: runResult.output,
      plan: runResult.sharedMemory.get("final_itinerary")
    });

  } catch (error: any) {
    console.error("❌ Orchestration execution error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 6. End-to-End Scenario Walkthrough

Below is a trace visualization showing how the systems communicate under a booking action:

```
User (UI)             Orchestrator          PolicyEngine            Redis (Cache)            MCP Server
   │                       │                      │                       │                       │
   │ 1. Plan & book Tokyo  │                      │                       │                       │
   ├──────────────────────►│                      │                       │                       │
   │                       │ 2. Compile Context   │                       │                       │
   │                       │ 3. Execute Searches  ├───────────────────────┼──────────────────────►│
   │                       │                      │                       │                       │
   │                       │                      │                       │                       │   Returns
   │                       │◄─────────────────────┼───────────────────────┼───────────────────────┤
   │                       │                      │                       │                       │   Hotels/Flights
   │                       │ 4. Propose booking   │                       │                       │
   │                       │    of Aman Tokyo     │                       │                       │
   │                       ├─────────────────────►│                       │                       │
   │                       │                      │ 5. Flag: Financial    │                       │
   │                       │◄─────────────────────┤    Action (Suspend)   │                       │
   │                       │                      │                       │                       │
   │                       │ 6. Checkpoint State ────────────────────────►│                       │
   │                       │                      │                       │                       │
   │ 7. Return 202         │                      │                       │                       │
   │    (Suspended payload)│                      │                       │                       │
   │◄──────────────────────┤                      │                       │                       │
   │                       │                      │                       │                       │
───┼───────────────────────┼──────────────────────┼───────────────────────┼───────────────────────┼───
   │   [USER APPROVAL INTERACTIVE STEP IN UI]      │                       │                       │
───┼───────────────────────┼──────────────────────┼───────────────────────┼───────────────────────┼───
   │                       │                      │                       │                       │
   │ 8. POST: Resolve      │                      │                       │                       │
   │    (Approved: true)   │                      │                       │                       │
   ├──────────────────────►│                      │                       │                       │
   │                       │ 9. Fetch Checkpoint ────────────────────────►│                       │
   │                       │◄─────────────────────────────────────────────┤                       │
   │                       │                      │                       │                       │
   │                       │ 10. Execute book_trip────────────────────────┼──────────────────────►│
   │                       │     (Secure sandboxed call)                  │                       │
   │                       │                      │                       │                       │   Confirmation
   │                       │◄─────────────────────────────────────────────┼───────────────────────┤   Number
   │                       │                      │                       │                       │
   │ 11. Render Completed  │                      │                       │                       │
   │     Itinerary & Recpt │                      │                       │                       │
   │◄──────────────────────┤                      │                       │                       │
```

1. **User Request**: The user enters *"Book the recommended luxury flight to Tokyo and reserve the Park Hyatt hotel rooms, then email me the receipt"* in the chat interface.
2. **Analysis and Proposal**: The booking agent maps the user's intent to the flight and hotel offers. The agent compiles these details into arguments and proposes executing the `book_trip` tool.
3. **Policy Gate Check**: The `PolicyEngine` intercepts the proposal. Finding a `safetyClass` value of `"financial"`, the rule `financial-escort` issues an `escalate` verdict.
4. **Execution Suspension**: The `Orchestrator` captures a complete checkpoint of the run state (including agent memory structures, run metrics, transcript, and stack context), stores it in the Redis cache under a unique session key, and emits an `approval_requested` status to Next.js.
5. **UI Prompt**: The frontend React chat detects the suspended status, blocks the chat input, and presents a glassmorphic checkout card showing:
   * Travel details (Flight offer JAL, Hotel Aman Tokyo).
   * Total price ($2,300.00).
   * Interactive "Approve Booking" and "Cancel" buttons.
6. **User Resolution**: The user reviews the details, completes secondary validation, and clicks **Approve Booking**.
7. **Resuming and Completion**: The client sends a resume POST payload to Next.js. The Orchestrator loads the checkpoint from Redis, replaces the tool execution proposal with the verified user response, and invokes the real `book_trip` tool via MCP transport. The booking executes, returns a reservation number, and the agent continues execution to write the booking details to the user's travel history ledger.

---

## 7. Production Deployment (Docker Environment)

To deploy both the `travel-planner` client and the stdio `mcp-travel-server` inside a single Docker sandbox, configure the Next.js production build to build the typescript files of the MCP server, and execute it under a non-root environment safely.

```dockerfile
# Multi-stage Dockerfile for deploying Next.js Travel Planner application using Bun
FROM oven/bun:1.1-alpine AS base

# Install build dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Rebuild the source code and compile the MCP Travel Server
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Compile Next.js client & build the TypeScript MCP Server
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
RUN bun run build

# Compile the MCP Travel Server so it can be spawned as a subprocess
WORKDIR /app/mcp-travel-server
RUN bun install --frozen-lockfile && bun run build

# Production image execution stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Setup secure system groups and users for sandboxed execution
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy client and server deployment artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/mcp-travel-server ./mcp-travel-server

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start the application
CMD ["bun", "run", "start"]
```
