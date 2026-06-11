// ─── Multi-Agent DAG Orchestrator ───────────────────────────────────────────
// Planner decomposes intent into tasks; ready tasks execute in parallel.

import type { Intent } from './intent.ts';
import type { ConversationMessage } from './types.ts';
import { runTurn, type RunnerCallbacks } from './runner.ts';
import { metrics } from '../session/metrics.ts';
import { budgetTracker } from '../session/budget.ts';
import { writeAudit } from '../enterprise/auditLog.ts';

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'debugger' | 'tester';

export interface AgentTask {
  id: string;
  agent: AgentRole;
  input: string;
  dependencies: string[];
  timeout: number;
  retries: number;
}

export interface AgentResult {
  taskId: string;
  agentName: string;
  status: 'success' | 'timeout' | 'error';
  output: string;
  timestamp: number;
}

/** Build a simple task DAG from parsed intent. */
export function planTasks(intent: Intent, userInput: string): AgentTask[] {
  const base = userInput;
  const files = intent.targets.files.join(', ') || 'project';

  if (intent.action === 'explain' || intent.action === 'review') {
    return [{
      id: 't1',
      agent: 'reviewer',
      input: `Explain/review: ${base}. Focus on: ${files}`,
      dependencies: [],
      timeout: 60_000,
      retries: 1,
    }];
  }

  if (intent.action === 'debug') {
    return [
      {
        id: 'debug',
        agent: 'debugger',
        input: `Trace root cause: ${base}. Files: ${files}`,
        dependencies: [],
        timeout: 90_000,
        retries: 1,
      },
      {
        id: 'code',
        agent: 'coder',
        input: `Fix based on debug findings: ${base}. Files: ${files}`,
        dependencies: ['debug'],
        timeout: 120_000,
        retries: 2,
      },
      {
        id: 'test',
        agent: 'tester',
        input: `Write/run tests to verify fix for: ${base}`,
        dependencies: ['code'],
        timeout: 90_000,
        retries: 1,
      },
      {
        id: 'review',
        agent: 'reviewer',
        input: `Final review of debug fix for: ${base}`,
        dependencies: ['test'],
        timeout: 60_000,
        retries: 1,
      },
    ];
  }

  return [
    {
      id: 'plan',
      agent: 'planner',
      input: `Create a numbered plan for: ${base}. Files: ${files}. Do not execute yet.`,
      dependencies: [],
      timeout: 45_000,
      retries: 1,
    },
    {
      id: 'code',
      agent: 'coder',
      input: `Implement: ${base}. Files: ${files}`,
      dependencies: ['plan'],
      timeout: 120_000,
      retries: 2,
    },
    {
      id: 'test',
      agent: 'tester',
      input: `Test the implementation for: ${base}`,
      dependencies: ['code'],
      timeout: 90_000,
      retries: 1,
    },
    {
      id: 'review',
      agent: 'reviewer',
      input: `Review the implementation for: ${base}`,
      dependencies: ['test'],
      timeout: 60_000,
      retries: 1,
    },
  ];
}

function buildDAG(tasks: AgentTask[]): AgentTask[] {
  // Topological sort — simple Kahn's algorithm
  const inDegree = new Map(tasks.map((t) => [t.id, t.dependencies.length]));
  const queue = tasks.filter((t) => t.dependencies.length === 0);
  const sorted: AgentTask[] = [];

  while (queue.length > 0) {
    const task = queue.shift()!;
    sorted.push(task);
    for (const t of tasks) {
      if (t.dependencies.includes(task.id)) {
        inDegree.set(t.id, (inDegree.get(t.id) ?? 1) - 1);
        if (inDegree.get(t.id) === 0) queue.push(t);
      }
    }
  }
  return sorted.length === tasks.length ? sorted : tasks;
}

const AGENT_PREFIX: Record<AgentRole, string> = {
  planner: '[Planner] ',
  coder: '[Coder] ',
  reviewer: '[Reviewer] ',
  debugger: '[Debugger] ',
  tester: '[Tester] ',
};

/**
 * Execute a DAG of agent tasks. Each task runs a full agent turn with
 * dependency outputs injected as context.
 */
export async function executeDAG(
  intent: Intent,
  userInput: string,
  history: ConversationMessage[],
  callbacks: RunnerCallbacks & {
    onAgentStart?: (agent: AgentRole, task: string) => void;
  },
): Promise<{ results: AgentResult[]; history: ConversationMessage[] }> {
  const tasks = buildDAG(planTasks(intent, userInput));
  const results = new Map<string, AgentResult>();
  let currentHistory = [...history];

  while (results.size < tasks.length) {
    const ready = tasks.filter(
      (t) =>
        !results.has(t.id) &&
        t.dependencies.every((dep) => results.has(dep)),
    );

    if (ready.length === 0) break;

    await Promise.all(
      ready.map(async (task) => {
        const start = Date.now();
        callbacks.onAgentStart?.(task.agent, task.input);

        const depOutputs = task.dependencies
          .map((id) => results.get(id)?.output)
          .filter(Boolean)
          .join('\n\n---\n\n');

        const agentInput = depOutputs
          ? `${AGENT_PREFIX[task.agent]}${task.input}\n\nPrior results:\n${depOutputs}`
          : `${AGENT_PREFIX[task.agent]}${task.input}`;

        let output = '';
        try {
          const turnCallbacks: RunnerCallbacks = {
            ...callbacks,
            onDelta: (text) => {
              output += text;
              callbacks.onDelta(AGENT_PREFIX[task.agent] + text);
            },
          };

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Agent timeout')), task.timeout),
          );

          currentHistory = await Promise.race([
            runTurn(currentHistory, agentInput, turnCallbacks),
            timeoutPromise,
          ]);

          results.set(task.id, {
            taskId: task.id,
            agentName: task.agent,
            status: 'success',
            output,
            timestamp: Date.now(),
          });
        } catch (err: any) {
          results.set(task.id, {
            taskId: task.id,
            agentName: task.agent,
            status: err.message === 'Agent timeout' ? 'timeout' : 'error',
            output: err.message ?? 'Unknown error',
            timestamp: Date.now(),
          });
        }

        const duration = Date.now() - start;
        metrics.recordAgent(task.agent, duration);
        budgetTracker.trackUsage(0, output.length / 4, task.agent);
        writeAudit({
          category: 'agent',
          action: 'task_complete',
          resource: task.id,
          details: { agent: task.agent, status: results.get(task.id)?.status, durationMs: duration },
        });
      }),
    );
  }

  return { results: [...results.values()], history: currentHistory };
}
