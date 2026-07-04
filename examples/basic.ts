// ─── Basic ZEX Example ──────────────────────────────────────────────────────
// Run with: bun run examples/basic.ts
//
// This shows how to use @zex/core programmatically:
//   1. Create an orchestrator with provider keys
//   2. Queue a task
//   3. Wait for the result
//
// Requires at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or
// GEMINI_API_KEY to be set in the environment or .env file.

import { ZexLLMOrchestrator } from '../packages/core/src/llm/orchestrator.ts';

// Gather API keys from environment
const keys: Array<{ provider: 'openai' | 'anthropic' | 'gemini'; apiKey: string }> = [];

if (process.env.OPENAI_API_KEY) {
  keys.push({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY });
}
if (process.env.ANTHROPIC_API_KEY) {
  keys.push({ provider: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY });
}
if (process.env.GEMINI_API_KEY) {
  keys.push({ provider: 'gemini', apiKey: process.env.GEMINI_API_KEY });
}

if (keys.length === 0) {
  console.error('No API keys found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.');
  process.exit(1);
}

// Create the orchestrator
const orchestrator = new ZexLLMOrchestrator({
  keys,
  dailyBudgetUSD: 1.0,
  maxConcurrentRequests: 2,
});

// Queue a simple task
const taskId = await orchestrator.queueTask('Write "Hello ZEX" in JSON format.', {
  model: keys[0]!.provider === 'openai' ? 'gpt-4o-mini'
    : keys[0]!.provider === 'anthropic' ? 'claude-3-haiku-latest'
    : 'gemini-2.0-flash',
});

// Poll for completion
console.log(`Task queued: ${taskId}`);
const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  const task = orchestrator.taskQueue.get(taskId);
  if (task && (task.status === 'completed' || task.status === 'failed')) {
    if (task.status === 'completed') {
      console.log('Result:', task.response);
      console.log('Usage:', JSON.stringify(orchestrator.budgetManager.getBudgetReport()));
    } else {
      console.error('Task failed:', task.error);
    }
    break;
  }
  await new Promise(r => setTimeout(r, 500));
}

orchestrator.destroy();
console.log('Done.');
