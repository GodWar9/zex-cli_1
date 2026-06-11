// ─── Collaborative Debugger — weighted agent voting ─────────────────────────

export interface AgentProposal {
  agent: string;
  solution: string;
  score: number;
}

const successHistory: Record<string, { wins: number; total: number }> = {
  coder: { wins: 5, total: 6 },
  reviewer: { wins: 4, total: 6 },
  debugger: { wins: 6, total: 7 },
};

function getWeight(agent: string): number {
  const h = successHistory[agent] ?? { wins: 1, total: 2 };
  return (h.wins / h.total) * 10;
}

/** Pick winning proposal by weighted vote. */
export function voteFixes(proposals: AgentProposal[]): {
  winner: AgentProposal;
  confidence: number;
} {
  if (proposals.length === 0) {
    return { winner: { agent: 'none', solution: 'No proposals', score: 0 }, confidence: 0 };
  }

  let best = proposals[0]!;
  let bestWeight = getWeight(best.agent) * best.score;

  for (const p of proposals.slice(1)) {
    const w = getWeight(p.agent) * p.score;
    if (w > bestWeight) {
      best = p;
      bestWeight = w;
    }
  }

  const totalWeight = proposals.reduce((s, p) => s + getWeight(p.agent) * p.score, 0);
  const confidence = totalWeight > 0 ? bestWeight / totalWeight : 0;

  successHistory[best.agent] = successHistory[best.agent] ?? { wins: 0, total: 0 };
  successHistory[best.agent]!.wins++;
  successHistory[best.agent]!.total++;

  return { winner: best, confidence };
}

export function formatVoteResult(
  proposals: AgentProposal[],
): string {
  const { winner, confidence } = voteFixes(proposals);
  const lines = [
    'Agent Vote Results:',
    ...proposals.map((p) => `  ${p.agent}: score ${p.score.toFixed(2)} (weight ${getWeight(p.agent).toFixed(1)})`),
    '',
    `Winner: ${winner.agent} (${(confidence * 100).toFixed(0)}% confidence)`,
    `Suggestion: ${winner.solution.slice(0, 200)}`,
  ];
  return lines.join('\n');
}
