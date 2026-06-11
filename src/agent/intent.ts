// ─── Intent Parser (disambiguator + security filter) ─────────────────────────
// Fast regex/heuristic parser — runs before context fetch. Complements the
// LLM-based clarifier with structured action types and risk classification.

export type IntentAction = 'explain' | 'fix' | 'refactor' | 'plan' | 'debug' | 'review';

export interface Intent {
  action: IntentAction;
  targets: {
    files: string[];
    functionNames?: string[];
    lineRanges?: [number, number][];
  };
  constraints: {
    dryRun: boolean;
    autoApply: boolean;
    forceReview: boolean;
  };
  securityFlags: {
    hasFileWrite: boolean;
    hasShellExec: boolean;
    hasDependencyChange: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

const FILE_MENTION_RE = /(?:@|file|in|update|fix|edit)\s+['"`]?([./\w\-/]+\.\w+)/gi;
const FUNC_MENTION_RE = /\b(?:function|fn|method)\s+['"`]?(\w+)/gi;
const LINE_RANGE_RE = /lines?\s+(\d+)\s*[-–]\s*(\d+)/gi;

function normalizeFilePath(raw: string): string {
  return raw.replace(/^['"`]|['"`]$/g, '').replace(/^\.\//, '');
}

function classifyRisk(flags: {
  hasFileWrite: boolean;
  hasShellExec: boolean;
  hasDependencyChange: boolean;
  isVague: boolean;
}): 'low' | 'medium' | 'high' {
  if (flags.hasShellExec && flags.hasFileWrite) return 'high';
  if (flags.hasDependencyChange) return 'high';
  if (flags.hasShellExec || flags.hasFileWrite) {
    return flags.isVague ? 'high' : 'medium';
  }
  return flags.isVague ? 'medium' : 'low';
}

/**
 * Parse user input into structured intent. No LLM — instant, deterministic.
 */
export function parseIntent(userInput: string): Intent {
  const lower = userInput.toLowerCase();

  let action: IntentAction = 'explain';
  if (/\/fix\b/.test(lower) || /\b(fix|repair|resolve)\b/.test(lower)) action = 'fix';
  else if (/\/refactor\b/.test(lower) || /\brefactor\b/.test(lower)) action = 'refactor';
  else if (/\/plan\b/.test(lower) || /\b(plan|design|architect)\b/.test(lower)) action = 'plan';
  else if (/\b(debug|trace|investigate)\b/.test(lower)) action = 'debug';
  else if (/\b(review|audit|check)\b/.test(lower)) action = 'review';

  const files: string[] = [];
  for (const m of userInput.matchAll(FILE_MENTION_RE)) {
    const p = normalizeFilePath(m[1]!);
    if (!files.includes(p)) files.push(p);
  }
  // Also catch bare paths like src/foo.ts
  for (const m of userInput.matchAll(/\b([./\w\-/]+\.(?:ts|tsx|js|jsx|py|go|rs|json|md|toml|yaml|yml))\b/g)) {
    const p = normalizeFilePath(m[1]!);
    if (!files.includes(p)) files.push(p);
  }

  const functionNames: string[] = [];
  for (const m of userInput.matchAll(FUNC_MENTION_RE)) {
    if (!functionNames.includes(m[1]!)) functionNames.push(m[1]!);
  }

  const lineRanges: [number, number][] = [];
  for (const m of userInput.matchAll(LINE_RANGE_RE)) {
    lineRanges.push([parseInt(m[1]!, 10), parseInt(m[2]!, 10)]);
  }

  const hasFileWrite = /\b(write|patch|create|delete|rename|add|implement|build)\b/i.test(userInput);
  const hasShellExec = /\b(run|exec|bash|shell|npm|pip|bun|git\s+clone|cargo)\b/i.test(userInput);
  const hasDependencyChange = /\b(add|remove|update|install).*(package|dependency|requirement|module)\b/i.test(userInput);

  const riskLevel = classifyRisk({
    hasFileWrite,
    hasShellExec,
    hasDependencyChange,
    isVague: files.length === 0 && userInput.length < 40,
  });

  return {
    action,
    targets: { files, functionNames: functionNames.length ? functionNames : undefined, lineRanges: lineRanges.length ? lineRanges : undefined },
    constraints: {
      dryRun: /--dry-run\b/.test(userInput),
      autoApply: false,
      forceReview: riskLevel === 'high',
    },
    securityFlags: { hasFileWrite, hasShellExec, hasDependencyChange, riskLevel },
  };
}
