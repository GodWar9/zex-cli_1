// ─── Enterprise Orchestrator & Server E2E Verification ──────────────────────────
// Run with: bun run test-enterprise.ts
// Verifies schedulers, token budgeting, key pools, failover classification,
// and the Bun.serve REST / WebSocket backend.

import { AdvancedTokenizer } from "./src/llm/tokenizer.ts";
import { CostCalculator } from "./src/llm/costCalculator.ts";
import { AdvancedScheduler, type ScheduledTask } from "./src/llm/advancedScheduler.ts";
import { PredictiveScheduler } from "./src/llm/predictiveScheduler.ts";
import { LLMProviderFactory } from "./src/llm/providers.ts";
import { TokenBudgetManager, LLMMonitor, FailureHandler, ZexLLMOrchestrator, FailureType } from "./src/llm/orchestrator.ts";
import { server, orchestrator } from "./src/api/server.ts";

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ${GREEN}✓${RESET} ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
}

function fail(label: string, err: string) {
  failed++;
  console.log(`  ${RED}✗${RESET} ${label}`);
  console.log(`    ${RED}${err}${RESET}`);
}

function section(title: string) {
  console.log(`\n${BOLD}${CYAN}── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}${RESET}`);
}

// Ensure the default server port is set for testing
process.env.PORT = "3051";
process.env.ZEX_AUTH_TOKEN = "test-secret-token";

// ─── 1. Advanced Tokenizer ────────────────────────────────────────────────────
section('Advanced Tokenizer');
try {
  const tokenizer = new AdvancedTokenizer();
  
  // Exact counting
  const count = tokenizer.countPromptTokensExact("Hello World!", "gpt-4o");
  if (count > 0) {
    ok("Counts prompt tokens exactly using tiktoken", `Count: ${count}`);
  } else {
    fail("tiktoken count failed", `Got count: ${count}`);
  }

  // Completion estimation
  const est1 = tokenizer.estimateCompletionTokens("Code me a server", "gpt-4o", { taskType: "coding" });
  const est2 = tokenizer.estimateCompletionTokens("Summarize this text", "gpt-4o", { taskType: "summary" });
  if (est1 > est2) {
    ok("Estimates completion tokens task-specifically (coding > summary)", `Coding: ${est1}, Summary: ${est2}`);
  } else {
    fail("Task-specific estimation failed", `Coding: ${est1}, Summary: ${est2}`);
  }

  // Total tokens
  const totalEst = tokenizer.estimateTotalTokens("Write a script", "gpt-4o-mini");
  if (totalEst.totalEstimatedTokens === totalEst.promptTokens + totalEst.estimatedCompletionTokens) {
    ok("Correctly aggregates total tokens");
  } else {
    fail("Total token estimation aggregation failed", JSON.stringify(totalEst));
  }
} catch (e: any) {
  fail("Tokenizer test exception", e.message);
}

// ─── 2. Cost Calculator ───────────────────────────────────────────────────────
section('Cost Calculator');
try {
  const costCalc = new CostCalculator();
  
  // Cost estimation
  const estimation = costCalc.estimateCost(1000, 2000, "gpt-4o");
  const expectedCost = (1000 / 1000) * 0.005 + (2000 / 1000) * 0.015; // $0.035
  if (Math.abs(estimation.totalCost - expectedCost) < 0.0001) {
    ok("Accurately calculates cost for prompt & completion", `Cost: $${estimation.totalCost}`);
  } else {
    fail("Cost calculation mismatch", `Got: $${estimation.totalCost}, expected: $${expectedCost}`);
  }

  // Cheapest model detection
  const cheapest = costCalc.findCheapestModel(1000, 2000);
  if (cheapest.model === "gemini-2.0-flash") {
    ok("Identifies cheapest model option correctly (gemini-2.0-flash)", `Model: ${cheapest.model}`);
  } else {
    fail("Cheapest model detection incorrect", cheapest.model);
  }
} catch (e: any) {
  fail("Cost Calculator exception", e.message);
}

// ─── 3. Advanced Scheduler ────────────────────────────────────────────────────
section('Advanced Scheduler');
try {
  const scheduler = new AdvancedScheduler();
  const now = Date.now();

  const taskLow: ScheduledTask = {
    id: "low", prompt: "", model: "gpt-4o", priority: 1, estimatedTokens: 100,
    status: "queued", retries: 0, maxRetries: 3, queuedAt: now, deadlineUrgency: 0,
    costToExecute: 0.1, expectedCompletionTime: 1000, dynamicPriority: 0
  };
  const taskHigh: ScheduledTask = {
    id: "high", prompt: "", model: "gpt-4o", priority: 9, estimatedTokens: 100,
    status: "queued", retries: 0, maxRetries: 3, queuedAt: now, deadlineUrgency: 0,
    costToExecute: 0.1, expectedCompletionTime: 1000, dynamicPriority: 0
  };
  const taskDeadlineConflict: ScheduledTask = {
    id: "critical", prompt: "", model: "gpt-4o", priority: 5, estimatedTokens: 100,
    status: "queued", retries: 0, maxRetries: 3, queuedAt: now, deadlineUrgency: 1,
    costToExecute: 0.1, expectedCompletionTime: 1000, dynamicPriority: 0,
    deadline: now + 60000 // 1 minute from now
  };

  const reordered = scheduler.reorderQueue([taskLow, taskHigh, taskDeadlineConflict]);
  if (reordered[0]?.id === "critical" && reordered[1]?.id === "high") {
    ok("Prioritizes deadline conflicts and higher priority correctly", `Order: ${reordered.map(t=>t.id).join(', ')}`);
  } else {
    fail("Scheduler queue reordering failed", `Order: ${reordered.map(t=>t.id).join(', ')}`);
  }
} catch (e: any) {
  fail("Advanced Scheduler exception", e.message);
}

// ─── 4. Predictive Scheduler ──────────────────────────────────────────────────
section('Predictive Scheduler');
try {
  const predictive = new PredictiveScheduler();
  
  // Baseline prediction
  const pred = predictive.predictCompletionTime("gpt-4o", 1000);
  if (pred.expectedCompletionTimeMs > 0 && pred.factors.modelFactor === 1.0) {
    ok("Calculates latency predictions based on model factors", `Predicted: ${pred.expectedCompletionTimeMs}ms`);
  } else {
    fail("Predictive scheduler calculation failed", JSON.stringify(pred));
  }

  // Optimize execution order
  const orderResult = predictive.findOptimalExecutionOrder([
    { id: "1", model: "gpt-4o", inputTokens: 500, deadline: Date.now() + 5000, priority: 5 },
    { id: "2", model: "gemini-2.0-flash", inputTokens: 200, deadline: Date.now() + 1000, priority: 1 }
  ], 2);

  if (orderResult.order.length === 2) {
    ok("Computes execution schedule and deadline success rate");
  } else {
    fail("Optimal order execution failed", JSON.stringify(orderResult));
  }
} catch (e: any) {
  fail("Predictive Scheduler exception", e.message);
}

// ─── 5. Token Budget Manager ──────────────────────────────────────────────────
section('Token Budget Manager');
try {
  const budget = new TokenBudgetManager(10.0); // $10 budget

  // Positive validation — use a small amount that fits within hourly cap ($10/24*1.5 ≈ $0.625)
  const aff1 = budget.canAfford(100, 0.10);
  if (aff1.canAfford) {
    ok("Approves execution within budget limits");
  } else {
    fail("Budget manager incorrectly blocked request", aff1.reason || "");
  }

  // Daily limit enforcement — record $9.50 usage then try to add $1.00 more
  budget.recordUsage(500000, 9.50, "gpt-4o", "openai", "analysis");
  const aff3 = budget.canAfford(100, 1.0);
  if (!aff3.canAfford && aff3.reason?.includes("budget exceeded")) {
    ok("Correctly blocks requests exceeding daily budget limits", aff3.reason);
  } else {
    fail("Daily budget enforcement failed", JSON.stringify(aff3));
  }
} catch (e: any) {
  fail("Token Budget Manager exception", e.message);
}

// ─── 6. Failure Handler & Classification ─────────────────────────────────────
section('Failure Handler & Classification');
try {
  const handler = new FailureHandler();

  const r1 = handler.classifyError({ status: 429, message: "Too many requests" });
  const r2 = handler.classifyError({ status: 401, message: "Unauthorized key" });
  const r3 = handler.classifyError({ status: 503 });

  if (r1.type === FailureType.RateLimit && r1.shouldRetry &&
      r2.type === FailureType.InvalidKey && !r2.shouldRetry &&
      r3.type === FailureType.ServiceDown) {
    ok("Accurately classifies rate limit, invalid key, and server down issues");
  } else {
    fail("Failure classification mismatch", `R1: ${JSON.stringify(r1)}, R2: ${JSON.stringify(r2)}, R3: ${JSON.stringify(r3)}`);
  }
} catch (e: any) {
  fail("Failure Handler exception", e.message);
}

// ─── 7. REST & WebSocket Server Integration ──────────────────────────────────
section('REST & WebSocket Server Integration');

try {
  // Use the actual port the server bound to (set at import-time, not from env)
  const actualPort = server.port;
  const baseUrl = `http://localhost:${actualPort}`;

  // Test Authentication Verification
  const badHealth = await fetch(`${baseUrl}/v1/health`, {
    headers: { "Authorization": "Bearer bad-token" }
  });
  if (badHealth.status === 401) {
    ok("Blocks requests with invalid authentication credentials");
  } else {
    fail("Allowed invalid credentials", `Status: ${badHealth.status}`);
  }

  const goodHealth = await fetch(`${baseUrl}/v1/health`, {
    headers: { "Authorization": "Bearer test-secret-token" }
  });
  if (goodHealth.status === 200) {
    const data = await goodHealth.json() as any;
    if (data.status === "healthy" && data.metrics) {
      ok("Returns overall orchestrator health status");
    } else {
      fail("Health payload invalid", JSON.stringify(data));
    }
  } else {
    fail("Good health check returned error", `Status: ${goodHealth.status}`);
  }

  // Check budget report endpoint
  const budgetRes = await fetch(`${baseUrl}/v1/budget`, {
    headers: { "x-zex-auth-token": "test-secret-token" }
  });
  if (budgetRes.status === 200) {
    const budgetReport = await budgetRes.json() as any;
    if (budgetReport.dailyBudgetUSD !== undefined) {
      ok("Exposes budget report endpoint");
    } else {
      fail("Budget report payload invalid", JSON.stringify(budgetReport));
    }
  } else {
    fail("Budget check failed", `Status: ${budgetRes.status}`);
  }

  // Check key pool stats endpoint
  const keysRes = await fetch(`${baseUrl}/v1/keys`, {
    headers: { "Authorization": "Bearer test-secret-token" }
  });
  if (keysRes.status === 200) {
    const keysStats = await keysRes.json() as any;
    if (keysStats.totalKeys !== undefined) {
      ok("Exposes API key pool statistics endpoint");
    } else {
      fail("Keys stats payload invalid", JSON.stringify(keysStats));
    }
  } else {
    fail("Keys check failed", `Status: ${keysRes.status}`);
  }

  // Setup WebSocket connection
  const session = `session-${Math.random().toString(36).substring(7)}`;
  const wsUrl = `ws://localhost:${actualPort}/v1/ws/${session}`;
  
  let wsConnected = false;
  let receivedChunks: string[] = [];
  let receivedMetrics = false;

  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    wsConnected = true;
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data as string);
    if (msg.type === "chunk") {
      receivedChunks.push(msg.text);
    } else if (msg.type === "metrics") {
      receivedMetrics = true;
    }
  };

  // Wait briefly for WebSocket connection
  await new Promise(resolve => setTimeout(resolve, 300));
  if (wsConnected) {
    ok("Successfully establishes real-time WebSocket connection session");
  } else {
    fail("WebSocket failed to connect", "ws.onopen did not fire");
  }

  // Send a test chat payload with session correlation
  const chatRes = await fetch(`${baseUrl}/v1/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-secret-token"
    },
    body: JSON.stringify({
      prompt: "Who are you?",
      model: "gpt-4o-mini",
      priority: 8,
      sessionId: session
    })
  });

  if (chatRes.status === 200) {
    const chatPayload = await chatRes.json() as any;
    if (chatPayload.status === "completed" && chatPayload.response) {
      ok("Synchronously executes task and retrieves chat completion response", chatPayload.response);
    } else {
      fail("Chat response structure incorrect", JSON.stringify(chatPayload));
    }
  } else {
    fail("Chat execution request failed", `Status: ${chatRes.status}`);
  }

  // Wait for streaming and broadcast metrics to flow (metrics broadcast every 2s)
  await new Promise(resolve => setTimeout(resolve, 2500));

  if (receivedChunks.length > 0) {
    ok("Streams real-time token chunks back via WebSocket connection", `Received chunks: ${receivedChunks.join('')}`);
  } else {
    fail("Streaming failed", "No token chunks received over WebSocket");
  }

  if (receivedMetrics) {
    ok("Streams metrics broadcasts over WebSocket connection");
  } else {
    fail("Metrics streaming failed", "No metrics messages received over WebSocket");
  }

  ws.close();

} catch (e: any) {
  fail("REST & WebSocket integration exception", e.stack || e.message);
}

// ─── Clean Exit and Summary ───────────────────────────────────────────────────
section('Summary');

console.log(`\n  Passed: ${GREEN}${passed}${RESET}`);
if (failed > 0) {
  console.log(`  Failed: ${RED}${failed}${RESET}`);
  console.log(`\n${RED}${BOLD}Verification Failed! Check above logs.${RESET}\n`);
  server.stop();
  orchestrator.destroy();
  process.exit(1);
} else {
  console.log(`\n  ${GREEN}${BOLD}All Enterprise Orchestrator and API verification tests passed!${RESET}\n`);
  server.stop();
  orchestrator.destroy();
  process.exit(0);
}
