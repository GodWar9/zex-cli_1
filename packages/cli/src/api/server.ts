import { ZexLLMOrchestrator } from "@zex/core/llm/orchestrator.ts";

function verifyAuth(req: Request): boolean {
  const authToken = process.env.ZEX_AUTH_TOKEN;
  if (!authToken) {
    return process.env.ZEX_AUTH_REQUIRED !== 'true'; // fail closed when ZEX_AUTH_REQUIRED=true
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("x-zex-auth-token") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  if (token === authToken) return true;

  try {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/v1/ws/")) {
      const queryToken = url.searchParams.get("token") || url.searchParams.get("auth");
      if (queryToken === authToken) return true;
    }
  } catch {
    // Ignore invalid URL parse for auth fallback.
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

const activeWebSockets = new Map<string, any>();

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

async function handleChat(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as any;
    const { prompt, model, priority, deadline, sessionId } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
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
      const task = orchestrator.taskQueue.get(taskId);
      return new Response(
        JSON.stringify({
          error: "Task execution timeout",
          taskId,
          status: task?.status ?? "unknown"
        }),
        { status: 504, headers: { "Content-Type": "application/json" } }
      );
    }

    const currentTask = orchestrator.taskQueue.get(taskId);
    if (!currentTask) {
      return new Response(
        JSON.stringify({ error: "Task not found after execution", taskId }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (currentTask.status === "failed") {
      return new Response(
        JSON.stringify({
          error: currentTask.error || "Task failed execution",
          taskId,
          status: "failed"
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        taskId,
        status: currentTask.status,
        response: currentTask.response || ""
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: `Invalid payload: ${msg}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}

const server = Bun.serve<{ sessionId: string }>({
  port: process.env.PORT || 3000,
  fetch(req, server) {
    // Enable CORS
    if (req.method === "OPTIONS") {
      return new Response("OK", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, x-zex-auth-token"
        }
      });
    }

    const url = new URL(req.url);

    // Verify auth for ALL endpoints (including WebSocket)
    if (!verifyAuth(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Handle WebSocket upgrade
    if (url.pathname.startsWith("/v1/ws/")) {
      const sessionId = url.pathname.split("/").pop() || "";
      const success = server.upgrade(req, {
        data: { sessionId }
      });
      if (success) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    };

    if (req.method === "POST" && url.pathname === "/v1/chat") {
      return handleChat(req);
    }

    if (req.method === "GET" && url.pathname === "/v1/health") {
      return new Response(JSON.stringify(orchestrator.getHealth()), { headers });
    }

    if (req.method === "GET" && url.pathname === "/v1/budget") {
      return new Response(JSON.stringify(orchestrator.budgetManager.getBudgetReport()), { headers });
    }

    if (req.method === "GET" && url.pathname === "/v1/keys") {
      return new Response(JSON.stringify(orchestrator.keyPool.getKeyStats()), { headers });
    }

    return new Response("Not Found", { status: 404, headers });
  },
  websocket: {
    open(ws) {
      const sessionId = (ws.data as any).sessionId;
      activeWebSockets.set(sessionId, ws);
      ws.send(JSON.stringify({ type: "status", message: `Connected to session ${sessionId}` }));
    },
    message(ws, message) {
      // Optional message processing
    },
    close(ws, code, reason) {
      const sessionId = (ws.data as any).sessionId;
      activeWebSockets.delete(sessionId);
    }
  }
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

console.log(`[Zex API Server] Running on http://localhost:${server.port}`);

function shutdown() {
  clearInterval(metricsInterval);
  orchestrator.destroy();
  server.stop();
}

export { server, orchestrator, shutdown };
