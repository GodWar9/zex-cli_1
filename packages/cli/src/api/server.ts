import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { ZexLLMOrchestrator } from "@zex/core/llm/orchestrator.ts";

// Runtime-agnostic (node:http + ws) — works under plain Node and under Bun.

function headerValue(headers: IncomingMessage["headers"], name: string): string {
  const v = headers[name];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function verifyAuth(url: URL, headers: IncomingMessage["headers"]): boolean {
  const authToken = process.env.ZEX_AUTH_TOKEN;
  if (!authToken) {
    return process.env.ZEX_AUTH_REQUIRED !== 'true'; // fail closed when ZEX_AUTH_REQUIRED=true
  }

  const authHeader = headerValue(headers, "authorization") || headerValue(headers, "x-zex-auth-token");
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  if (token === authToken) return true;

  if (url.pathname.startsWith("/v1/ws/")) {
    const queryToken = url.searchParams.get("token") || url.searchParams.get("auth");
    if (queryToken === authToken) return true;
  }

  return false;
}

function gatherKeys(): Array<{ provider: "openai" | "anthropic" | "gemini"; apiKey: string; priority: number }> {
  const keys: Array<{ provider: "openai" | "anthropic" | "gemini"; apiKey: string; priority: number }> = [];

  if (process.env.OPENAI_API_KEY) {
    keys.push({ provider: "openai", apiKey: process.env.OPENAI_API_KEY, priority: 10 });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    keys.push({ provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, priority: 8 });
  }
  if (process.env.GEMINI_API_KEY) {
    keys.push({ provider: "gemini", apiKey: process.env.GEMINI_API_KEY, priority: 6 });
  }
  if (process.env.GEMINI_API_KEYS) {
    for (const k of process.env.GEMINI_API_KEYS.split(",").map(k => k.trim()).filter(Boolean)) {
      keys.push({ provider: "gemini", apiKey: k, priority: 6 });
    }
  }

  return keys;
}

function createOrchestrator() {
  const keysConfig = gatherKeys();
  if (keysConfig.length === 0) {
    console.warn('[zex] No API keys configured via environment variables — LLM features disabled');
  }
  return new ZexLLMOrchestrator({
    keys: keysConfig,
    dailyBudgetUSD: 10.0,
    maxConcurrentRequests: 5
  });
}

const orchestrator = createOrchestrator();

const activeWebSockets = new Map<string, WebSocket>();

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

function waitForTask(taskId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const poll = () => {
      const task = orchestrator.taskQueue.get(taskId);
      if (!task || TERMINAL_STATUSES.has(task.status)) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      setTimeout(poll, 200);
    };
    poll();
  });
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(body));
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    sendJson(res, 400, { error: `Invalid payload: ${msg}` });
    return;
  }

  const { prompt, model, priority, deadline, sessionId } = body ?? {};

  if (!prompt) {
    sendJson(res, 400, { error: "Prompt is required" });
    return;
  }

  const taskId = await orchestrator.queueTask(prompt, {
    model,
    priority,
    deadline,
    onChunk: (chunk: string) => {
      if (sessionId) {
        const ws = activeWebSockets.get(sessionId);
        if (ws) {
          ws.send(JSON.stringify({ type: "chunk", text: chunk, taskId }));
        }
      }
    }
  });

  const task = orchestrator.taskQueue.get(taskId);
  if (task) {
    (task as any).sessionId = sessionId;
  }

  // Wait for completion (timeout after 30 seconds)
  const completed = await waitForTask(taskId, 30000);
  if (!completed) {
    const pendingTask = orchestrator.taskQueue.get(taskId);
    sendJson(res, 504, {
      error: "Task execution timeout",
      taskId,
      status: pendingTask?.status ?? "unknown"
    });
    return;
  }

  const currentTask = orchestrator.taskQueue.get(taskId);
  if (!currentTask) {
    sendJson(res, 500, { error: "Task not found after execution", taskId });
    return;
  }

  if (currentTask.status === "failed") {
    sendJson(res, 500, {
      error: currentTask.error || "Task failed execution",
      taskId,
      status: "failed"
    });
    return;
  }

  sendJson(res, 200, {
    taskId,
    status: currentTask.status,
    response: currentTask.response || ""
  });
}

const httpServer = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-zex-auth-token"
    });
    res.end("OK");
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host ?? "localhost"}`);

  // Verify auth for ALL endpoints (including WebSocket upgrade attempts that
  // fall through to here, e.g. a plain GET on a /v1/ws/ path)
  if (!verifyAuth(url, req.headers)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  // Real WebSocket upgrades are handled by the 'upgrade' event below and
  // never reach this handler. Reaching here on a /v1/ws/ path means the
  // client didn't send a proper Upgrade handshake.
  if (url.pathname.startsWith("/v1/ws/")) {
    res.writeHead(400, { "Access-Control-Allow-Origin": "*" });
    res.end("WebSocket upgrade failed");
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/chat") {
    await handleChat(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/health") {
    sendJson(res, 200, orchestrator.getHealth());
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/budget") {
    sendJson(res, 200, orchestrator.budgetManager.getBudgetReport());
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/keys") {
    sendJson(res, 200, orchestrator.keyPool.getKeyStats());
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end("Not Found");
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
  const url = new URL(req.url || "/", `http://${req.headers.host ?? "localhost"}`);

  if (!url.pathname.startsWith("/v1/ws/")) {
    socket.destroy();
    return;
  }

  if (!verifyAuth(url, req.headers)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  const sessionId = url.pathname.split("/").pop() || "";

  wss.handleUpgrade(req, socket, head, (ws) => {
    (ws as any).sessionId = sessionId;
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws: WebSocket & { sessionId?: string }) => {
  const sessionId = ws.sessionId || "";
  activeWebSockets.set(sessionId, ws);
  ws.send(JSON.stringify({ type: "status", message: `Connected to session ${sessionId}` }));

  ws.on("close", () => {
    activeWebSockets.delete(sessionId);
  });
});

// Periodic broadcasting of metrics
const metricsInterval = setInterval(() => {
  if (activeWebSockets.size === 0) return;
  const health = orchestrator.getHealth();
  const metricsMessage = JSON.stringify({
    type: "metrics",
    metrics: health.metrics,
    budget: health.budget,
    queue: health.queue,
    keys: health.keys
  });
  for (const ws of activeWebSockets.values()) {
    try {
      ws.send(metricsMessage);
    } catch {
      // Handle disconnected ws cleanly
    }
  }
}, 2000);

const boundPort = await new Promise<number>((resolve, reject) => {
  httpServer.once("error", reject);
  const requestedPort = Number(process.env.PORT) || 3000;
  httpServer.listen(requestedPort, () => {
    const addr = httpServer.address();
    resolve(typeof addr === "object" && addr ? addr.port : requestedPort);
  });
});

const server = {
  port: boundPort,
  stop: () => { httpServer.close(); wss.close(); }
};

console.log(`[Zex API Server] Running on http://localhost:${server.port}`);

function shutdown() {
  clearInterval(metricsInterval);
  orchestrator.destroy();
  server.stop();
}

export { server, orchestrator, shutdown };
