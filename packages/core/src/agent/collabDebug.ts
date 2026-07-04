// ─── Collaborative debugging — parallel proposals + weighted vote (Q2) ────────

import type { Intent } from './intent.ts';
import type { ConversationMessage } from './types.ts';
import { runTurn, type RunnerCallbacks } from './runner.ts';
import { voteFixes, formatVoteResult, type AgentProposal } from './voting.ts';
import { metrics } from '../session/metrics.ts';
import { budgetTracker } from '../session/budget.ts';
import { writeAudit } from '../enterprise/auditLog.ts';

const DEBUG_AGENTS = ['coder', 'debugger', 'reviewer'] as const;

const DEBUG_PROMPTS: Record<string, string> = {
  coder: 'As Coder, analyze the bug and propose a concrete code fix with file paths.',
  debugger: 'As Debugger, trace root cause — check env vars, logic flow, and edge cases.',
  reviewer: 'As Reviewer, identify what could be wrong and suggest the safest fix approach.',
};

/**
 * Run collaborative debugging: 3 agents propose fixes in parallel, vote picks winner.
 */
export async function collaborativeDebug(
  intent: Intent,
  userInput: string,
  history: ConversationMessage[],
  callbacks: RunnerCallbacks & {
    onAgentStart?: (agent: string, task: string) => void;
    onVoteResult?: (text: string) => void;
  },
): Promise<{ winner: AgentProposal; history: ConversationMessage[]; voteSummary: string }> {
  const files = intent.targets.files.join(', ') || 'the codebase';
  const task = `Debug: ${userInput}. Focus files: ${files}`;

  callbacks.onAgentStart?.('collab', 'Running collaborative debug — 3 agents proposing fixes…');

  const proposals: AgentProposal[] = [];
  let currentHistory = [...history];

  // Run agents sequentially (parallel would triple API cost); collect proposals
  for (const agent of DEBUG_AGENTS) {
    const start = Date.now();
    callbacks.onAgentStart?.(agent, DEBUG_PROMPTS[agent]!);

    let output = '';
    const agentInput = `[${agent.toUpperCase()}] ${DEBUG_PROMPTS[agent]}\n\nUser issue: ${task}`;

    try {
      currentHistory = await runTurn(currentHistory, agentInput, {
        ...callbacks,
        onDelta: (text) => {
          output += text;
          callbacks.onDelta(`[${agent}] ${text}`);
        },
      });

      const score = output.length > 50 ? 0.7 + Math.min(0.3, output.length / 2000) : 0.3;
      proposals.push({ agent, solution: output, score });
      budgetTracker.trackUsage(0, output.length / 4, agent);
    } catch {
      proposals.push({ agent, solution: `Failed to analyze`, score: 0.1 });
    }

    metrics.recordAgent(agent, Date.now() - start);
  }

  const { winner, confidence } = voteFixes(proposals);
  const voteSummary = formatVoteResult(proposals) +
    `\n\n→ Applying ${winner.agent}'s approach (${(confidence * 100).toFixed(0)}% confidence)`;

  writeAudit({
    category: 'agent',
    action: 'collab_vote',
    details: { winner: winner.agent, confidence, proposals: proposals.length },
  });

  callbacks.onVoteResult?.(voteSummary);

  return { winner, history: currentHistory, voteSummary };
}
