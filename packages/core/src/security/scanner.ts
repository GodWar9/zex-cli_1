// ─── Security Scanner ─────────────────────────────────────────────────────────
// Scans code content for common vulnerability patterns before writes are executed.
// Called by write_file, patch_file, and patch_semantic BEFORE the write occurs.

export type Severity = 'critical' | 'high' | 'medium';

export interface SecurityFinding {
  label: string;
  severity: Severity;
  matchedLine: string;
  lineNumber?: number;
}

const RULES: Array<{ pattern: RegExp; label: string; severity: Severity }> = [
  {
    pattern: /(?:select|insert|update|delete|drop|where)\s.*?\+.*?(?:req\.|user\.|input|params|body)/i,
    label: 'SQL string concatenation — injection risk',
    severity: 'critical',
  },
  {
    pattern: /innerHTML\s*=\s*[^'"`\s]/,
    label: 'Unsanitized innerHTML — XSS risk',
    severity: 'critical',
  },
  {
    pattern: /eval\s*\(/,
    label: 'eval() usage',
    severity: 'critical',
  },
  {
    pattern: /child_process\.exec\([^)]*[+]/,
    label: 'Unsanitized exec() — command injection',
    severity: 'critical',
  },
  {
    pattern: /Math\.random\(\).{0,40}(token|secret|key|pass)/i,
    label: 'Math.random() for secrets — use crypto',
    severity: 'high',
  },
  {
    pattern: /process\.env\.[A-Z_]+ ?= ?/,
    label: 'Runtime env mutation',
    severity: 'medium',
  },
  {
    pattern: /require\(['"`]\.\.\//,
    label: 'Path traversal in require()',
    severity: 'medium',
  },
  {
    pattern: /(?:AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36,}|gho_[a-zA-Z0-9]{36,})/,
    label: 'Hardcoded API key or token',
    severity: 'critical',
  },
  {
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    label: 'Hardcoded private key',
    severity: 'critical',
  },
  {
    pattern: /(?:fetch|axios|request|got)\s*\([^)]*\+/,
    label: 'String concatenation in URL — SSRF risk',
    severity: 'high',
  },
  {
    pattern: /process\.env\.(?:AWS_SECRET|SECRET|TOKEN|PASSWORD|PASS|CREDENTIALS)/i,
    label: 'Potential secret exposure via env',
    severity: 'high',
  },
  {
    pattern: /fs\.(?:writeFile|appendFile|copyFile)\s*\([^)]*user/,
    label: 'Unsanitized user input in file write',
    severity: 'high',
  },
];

/**
 * Scans code line-by-line for security vulnerability patterns.
 * Returns an array of all findings (may be empty).
 */
export function scanCode(code: string): SecurityFinding[] {
  const lines = code.split('\n');
  const findings: SecurityFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const rule of RULES) {
      if (rule.pattern.test(line)) {
        findings.push({
          label: rule.label,
          severity: rule.severity,
          matchedLine: line.trim(),
          lineNumber: i + 1,
        });
      }
    }
  }

  return findings;
}
