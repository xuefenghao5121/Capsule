/**
 * Gateway - WebSocket and HTTP API
 */

import { createServer, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { SandboxManager } from "../sandbox/manager.js";
import { Scheduler } from "../scheduler/scheduler.js";
import { ToolRegistry } from "../tools/registry.js";
import { SessionStore } from "../session/store.js";
import { TelemetryManager } from "../telemetry/index.js";

/**
 * Gateway Configuration
 */
export interface GatewayConfig {
  port: number;
  host: string;
  auth?: {
    type: "none" | "token";
    token?: string;
  };
}

const DEFAULT_CONFIG: GatewayConfig = {
  port: 18789,
  host: "0.0.0.0",
  auth: { type: "none" },
};

/**
 * JSON-RPC Request
 */
interface RPCRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC Response
 */
interface RPCResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Gateway
 * 
 * HTTP and WebSocket API server for Capsule
 */
export class Gateway {
  private config: GatewayConfig;
  private httpServer: Server;
  private wsServer: WebSocketServer;
  private sandboxManager: SandboxManager;
  private scheduler: Scheduler;
  private toolRegistry: ToolRegistry;
  private sessionStore: SessionStore;
  private telemetry: TelemetryManager;
  private clients: Set<WebSocket> = new Set();

  constructor(
    sandboxManager: SandboxManager,
    scheduler: Scheduler,
    toolRegistry: ToolRegistry,
    sessionStore: SessionStore,
    telemetry: TelemetryManager,
    config: Partial<GatewayConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sandboxManager = sandboxManager;
    this.scheduler = scheduler;
    this.toolRegistry = toolRegistry;
    this.sessionStore = sessionStore;
    this.telemetry = telemetry;

    // Create HTTP server
    this.httpServer = createServer(this.handleHttpRequest.bind(this));

    // Create WebSocket server
    this.wsServer = new WebSocketServer({ server: this.httpServer });
    this.wsServer.on("connection", this.handleWsConnection.bind(this));
  }

  /**
   * Start the gateway
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(
          `Capsule Gateway listening on ${this.config.host}:${this.config.port}`
        );
        resolve();
      });
    });
  }

  /**
   * Stop the gateway
   */
  async stop(): Promise<void> {
    // Close all WebSocket connections
    for (const client of this.clients) {
      client.close();
    }

    return new Promise((resolve) => {
      this.httpServer.close(() => resolve());
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse
  ): void {
    const url = req.url || "/";
    const method = req.method || "GET";

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (url === "/health" || url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date() }));
      return;
    }

    // API endpoints
    if (url.startsWith("/api/")) {
      this.handleApiRequest(req, res);
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * Handle API requests
   */
  private handleApiRequest(
    req: import("http").IncomingMessage,
    res: import("http").ServerResponse
  ): void {
    const url = req.url || "";

    // GET /api/sandboxes - List sandboxes
    if (url === "/api/sandboxes" && req.method === "GET") {
      this.sandboxManager.list().then((sandboxes) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(sandboxes));
      });
      return;
    }

    // GET /api/tools - List tools
    if (url === "/api/tools" && req.method === "GET") {
      const tools = this.toolRegistry.list();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(tools));
      return;
    }

    // GET /api/metrics - Get metrics
    if (url === "/api/metrics" && req.method === "GET") {
      const metrics = this.telemetry.getMetrics();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(metrics));
      return;
  }

    // GET /api/stats - Get statistics
    if (url === "/api/stats" && req.method === "GET") {
      const stats = {
        sandboxes: this.sandboxManager.getStats(),
        scheduler: {
          running: 0, // Would get from scheduler
        },
        sessions: this.sessionStore.getStats(),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * Handle WebSocket connection
   */
  private handleWsConnection(ws: WebSocket): void {
    this.clients.add(ws);

    ws.on("message", (data: Buffer) => {
      try {
        const request: RPCRequest = JSON.parse(data.toString());
        this.handleRpcRequest(ws, request);
      } catch (error) {
        this.sendError(ws, null, -32700, "Parse error");
      }
    });

    ws.on("close", () => {
      this.clients.delete(ws);
    });

    // Send welcome message
    this.sendResponse(ws, null, {
      status: "connected",
      version: "0.1.0",
    });
  }

  /**
   * Handle RPC request
   */
  private handleRpcRequest(ws: WebSocket, request: RPCRequest): void {
    const { id, method, params } = request;

    // Check auth
    if (this.config.auth?.type === "token") {
      // Would check token here
    }

    // Route to handler
    switch (method) {
      case "sandbox.create":
        this.handleSandboxCreate(ws, id, params);
        break;
      case "sandbox.destroy":
        this.handleSandboxDestroy(ws, id, params);
        break;
      case "sandbox.list":
        this.handleSandboxList(ws, id);
        break;
      case "tool.list":
        this.handleToolList(ws, id);
        break;
      case "task.submit":
        this.handleTaskSubmit(ws, id, params);
        break;
      default:
        this.sendError(ws, id, -32601, `Method not found: ${method}`);
    }
  }

  private async handleSandboxCreate(
    ws: WebSocket,
    id: string | number | undefined,
    params?: Record<string, unknown>
  ): Promise<void> {
    try {
      const sandbox = await this.sandboxManager.create(params as any);
      this.sendResponse(ws, id, sandbox.toJSON());
    } catch (error) {
      this.sendError(
        ws,
        id,
        -32000,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleSandboxDestroy(
    ws: WebSocket,
    id: string | number | undefined,
    params?: Record<string, unknown>
  ): Promise<void> {
    try {
      const sandboxId = params?.sandboxId as string;
      await this.sandboxManager.destroy(sandboxId);
      this.sendResponse(ws, id, { success: true });
    } catch (error) {
      this.sendError(
        ws,
        id,
        -32000,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleSandboxList(
    ws: WebSocket,
    id: string | number | undefined
  ): Promise<void> {
    const sandboxes = await this.sandboxManager.list();
    this.sendResponse(
      ws,
      id,
      sandboxes.map((s) => s.toJSON())
    );
  }

  private handleToolList(
    ws: WebSocket,
    id: string | number | undefined
  ): void {
    const tools = this.toolRegistry.list();
    this.sendResponse(ws, id, tools);
  }

  private async handleTaskSubmit(
    ws: WebSocket,
    id: string | number | undefined,
    params?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Would submit task to scheduler
      this.sendResponse(ws, id, { success: true, taskId: "task-xxx" });
    } catch (error) {
      this.sendError(
        ws,
        id,
        -32000,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private sendResponse(
    ws: WebSocket,
    id: string | number | undefined,
    result: unknown
  ): void {
    const response: RPCResponse = {
      jsonrpc: "2.0",
      id,
      result,
    };
    ws.send(JSON.stringify(response));
  }

  private sendError(
    ws: WebSocket,
    id: string | number | undefined,
    code: number,
    message: string
  ): void {
    const response: RPCResponse = {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(method: string, params: unknown): void {
    const message = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}