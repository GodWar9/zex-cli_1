import { ZexLLMOrchestrator } from "../llm/orchestrator.ts";

const expectedAuthToken = process.env.ZEX_AUTH_TOKEN || "zex-admin-token";

function verifyAuth(req: Request): boolean {
  // If no auth token is set in env (and we are not in testing), we default to validating against "zex-admin-token".
  // Let's support verifying the x-zex-auth-token or Authorization header.
  const authHeader = req.headers.get("Authorization") || req.headers.get("x-zex-auth-token") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  // For testing convenience, if ZEX_AUTH_TOKEN is explicitly set, we validate it.
  const tokenToValidate = process.env.ZEX_AUTH_TOKEN || "zex-admin-token";
  return token === tokenToValidate;
}

// Extract GEMINI_API_KEYs from environment or .env format.
// GEMINI_API_KEY in .env might be a JSON set/array or a single key.
const geminiKeys: string[] = [];
const rawGeminiEnv = process.env.GEMINI_API_KEY || "";
if (rawGeminiEnv.trim().startsWith("{") || rawGeminiEnv.trim().startsWith("[")) {
  try {
    // Attempt parsing as JSON/array/set style.
    // Replace quotes and brackets to extract keys.
    const keys = rawGeminiEnv
      .replace(/[\{\}\[\]\n\r"']/g, "")
      .split(",")
      .map(k => k.trim())
      .filter(k => k.length > 0);
    geminiKeys.push(...keys);
  } catch {
    if (rawGeminiEnv) geminiKeys.push(rawGeminiEnv);
  }
} else if (rawGeminiEnv) {
  geminiKeys.push(rawGeminiEnv);
}

if (geminiKeys.length === 0) {
  geminiKeys.push("gemini-test");
}

const keysConfig = [
  { provider: "openai" as const, apiKey: process.env.OPENAI_API_KEY || "sk-test", priority: 10 },
  { provider: "anthropic" as const, apiKey: process.env.ANTHROPIC_API_KEY || "claude-test", priority: 8 },
  ...geminiKeys.map(key => ({ provider: "gemini" as const, apiKey: key, priority: 6 }))
];

const orchestrator = new ZexLLMOrchestrator({
  keys: keysConfig,
  dailyBudgetUSD: 10.0,
  maxConcurrentRequests: 5
});

const activeWebSockets = new Map<string, any>();

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

    // Wait for completion (timeout after 30 seconds to be reasonable)
    const start = Date.now();
    let currentTask = orchestrator.taskQueue.get(taskId);
    while (
      currentTask &&
      (currentTask.status === "queued" ||
        currentTask.status === "assigned" ||
        currentTask.status === "executing")
    ) {
      if (Date.now() - start > 30000) {
        return new Response(
          JSON.stringify({ error: "Task execution timeout", taskId, status: currentTask.status }),
          { status: 504, headers: { "Content-Type": "application/json" } }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      currentTask = orchestrator.taskQueue.get(taskId);
    }

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
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Invalid payload: ${(error as Error).message}` }),
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

    // Verify auth for REST endpoints
    if (!verifyAuth(req)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
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
setInterval(() => {
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

export { server, orchestrator };
