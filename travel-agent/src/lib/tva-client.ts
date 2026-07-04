/**
 * TvaMcpManager — connects to the TVA OTA MCP server suite (flight, hotel,
 * visa, immigration, account — see the sibling TravelAgentMCP repo's
 * mcps/*) over stdio, one child process per domain, scoped to a single
 * conversation session.
 *
 * Two things make this different from SocialMCPClient:
 *
 *  1. Bearer token injection: TVA_ACCESS_TOKEN is never a tool argument —
 *     it's injected into each spawned child's environment from this
 *     session's stored token (see tva-session.ts), so the model never
 *     handles it directly.
 *
 *  2. Session envelope interception: account-mcp's LOGIN_USER /
 *     SOCIAL_AUTH_LOGIN / LOGOUT_USER / CLOSE_ACCOUNT wrap their result in
 *     `{ message, __session? , __clearSession? }` instead of returning the
 *     token as plain text. callTool() detects that shape, persists/clears
 *     the token via tva-session.ts, and returns only `message` to the
 *     caller — the raw token never enters the Gemini conversation.
 *
 * Domains whose binary isn't found (e.g. TravelAgentMCP not checked out
 * locally) are skipped with a warning rather than crashing the agent —
 * NomadSage still works for knowledge-base Q&A and social replies without
 * booking capability.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { FunctionDeclaration } from "../tools/travel.js";
import { mcpToolToGemini, type MCPTool } from "./mcp-client.js";
import { clearTvaSession, getTvaSession, saveTvaSession, tryRecordLoginAttempt } from "./tva-session.js";

type ToolCallContent = { type: string; text?: string };

const DOMAINS = ["flight", "hotel", "visa", "immigration", "account"] as const;
type Domain = (typeof DOMAINS)[number];

const LOGIN_TOOLS = new Set(["LOGIN_USER", "SOCIAL_AUTH_LOGIN"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Default sibling-checkout layout: MegaMind/travel-agent/.. -> MegaMind -> nxGnosis -> TravelAgentMCP. */
function defaultBinPath(domain: Domain): string {
	return path.resolve(
		__dirname,
		"..",
		"..",
		"..",
		"..",
		"TravelAgentMCP",
		"mcps",
		`${domain}-mcp`,
		"dist",
		"index.js",
	);
}

function resolveBinPath(domain: Domain): string {
	const envVar = `TVA_${domain.toUpperCase()}_MCP_PATH`;
	return process.env[envVar] || defaultBinPath(domain);
}

interface DomainConnection {
	domain: Domain;
	client: Client;
	transport: StdioClientTransport;
	toolNames: Set<string>;
}

export class TvaMcpManager {
	private sessionId: string;
	private connections: DomainConnection[] = [];
	private toolToDomain = new Map<string, Domain>();

	constructor(sessionId: string) {
		this.sessionId = sessionId;
	}

	get enabled(): boolean {
		return (process.env.TVA_MCP_ENABLED ?? "true").toLowerCase() !== "false";
	}

	async connect(): Promise<void> {
		if (!this.enabled) return;

		const session = getTvaSession(this.sessionId);
		const env: Record<string, string> = {
			...(process.env as Record<string, string>),
			...(session ? { TVA_ACCESS_TOKEN: session.token } : {}),
		};

		for (const domain of DOMAINS) {
			const binPath = resolveBinPath(domain);
			if (!fs.existsSync(binPath)) {
				console.warn(`[tva-client] ${domain}-mcp not found at ${binPath} — skipping (booking tools for ${domain} disabled).`);
				continue;
			}

			try {
				const transport = new StdioClientTransport({ command: "node", args: [binPath], env });
				const client = new Client({ name: "nomadsage-travel-agent", version: "1.0.0" }, { capabilities: {} });
				await client.connect(transport);

				const { tools } = await client.listTools();
				const toolNames = new Set(tools.map((t) => t.name));
				for (const name of toolNames) this.toolToDomain.set(name, domain);

				this.connections.push({ domain, client, transport, toolNames });
			} catch (err) {
				console.warn(`[tva-client] Failed to connect ${domain}-mcp:`, (err as Error).message);
			}
		}
	}

	async listToolsAsGemini(): Promise<FunctionDeclaration[]> {
		const declarations: FunctionDeclaration[] = [];
		for (const conn of this.connections) {
			const { tools } = await conn.client.listTools();
			declarations.push(...(tools as MCPTool[]).map(mcpToolToGemini));
		}
		return declarations;
	}

	hasTool(name: string): boolean {
		return this.toolToDomain.has(name);
	}

	async callTool(name: string, input: Record<string, unknown>): Promise<string> {
		const domain = this.toolToDomain.get(name);
		if (!domain) throw new Error(`Unknown TVA tool: ${name}`);

		if (LOGIN_TOOLS.has(name) && !tryRecordLoginAttempt(this.sessionId)) {
			return "Too many login attempts in this conversation. Please wait a few minutes and try again.";
		}

		const conn = this.connections.find((c) => c.domain === domain);
		if (!conn) throw new Error(`${domain}-mcp is not connected.`);

		const result = await conn.client.callTool({ name, arguments: input });
		const text = (result.content as ToolCallContent[])
			.filter((b) => b.type === "text")
			.map((b) => b.text ?? "")
			.join("\n");

		if (result.isError) throw new Error(text || `${name} returned an error`);

		return this.interceptSessionEnvelope(text);
	}

	/** Detects account-mcp's `{ message, __session? , __clearSession? }` envelope and never lets the raw token through. */
	private interceptSessionEnvelope(text: string): string {
		let parsed: any;
		try {
			parsed = JSON.parse(text);
		} catch {
			return text;
		}

		if (parsed && typeof parsed === "object" && "__session" in parsed) {
			saveTvaSession(this.sessionId, parsed.__session);
			return parsed.message ?? "Logged in.";
		}

		if (parsed && typeof parsed === "object" && parsed.__clearSession) {
			clearTvaSession(this.sessionId);
			return parsed.message ?? "Session ended.";
		}

		return text;
	}

	async disconnect(): Promise<void> {
		await Promise.all(this.connections.map((c) => c.client.close().catch(() => undefined)));
		this.connections = [];
		this.toolToDomain.clear();
	}
}
