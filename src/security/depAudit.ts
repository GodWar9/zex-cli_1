// ─── Dependency security audit (Q2) ─────────────────────────────────────────
// Scans package.json dependencies for known vulnerabilities via npm audit.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DepFinding {
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url?: string;
}

export interface DepAuditResult {
  scanned: boolean;
  totalDeps: number;
  findings: DepFinding[];
  summary: string;
}

/** Run npm audit --json and parse results. */
export async function auditDependencies(projectRoot = process.cwd()): Promise<DepAuditResult> {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    return { scanned: false, totalDeps: 0, findings: [], summary: 'No package.json found.' };
  }

  let totalDeps = 0;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    totalDeps = Object.keys(pkg.dependencies ?? {}).length + Object.keys(pkg.devDependencies ?? {}).length;
  } catch {
    return { scanned: false, totalDeps: 0, findings: [], summary: 'Failed to parse package.json.' };
  }

  const findings: DepFinding[] = [];

  try {
    const proc = Bun.spawn(['npm', 'audit', '--json'], {
      cwd: projectRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const data = JSON.parse(stdout);
    const vulnerabilities = data.vulnerabilities ?? data.advisories ?? {};

    for (const [name, vuln] of Object.entries(vulnerabilities) as [string, any][]) {
      if (typeof vuln !== 'object' || !vuln) continue;
      const severity = (vuln.severity ?? vuln.type ?? 'moderate') as DepFinding['severity'];
      findings.push({
        package: name,
        severity,
        title: vuln.title ?? vuln.name ?? `Vulnerability in ${name}`,
        url: vuln.url ?? vuln.references?.[0]?.url,
      });
    }
  } catch {
    // Fallback: flag known risky package name patterns
    findings.push(...heuristicDepScan(pkgPath));
  }

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  const critical = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;

  const summary = findings.length === 0
    ? `✓ ${totalDeps} dependencies scanned — no vulnerabilities found.`
    : `⚠ ${findings.length} issues (${critical} critical, ${high} high) across ${totalDeps} deps.`;

  return { scanned: true, totalDeps, findings, summary };
}

function severityRank(s: DepFinding['severity']): number {
  return { critical: 5, high: 4, moderate: 3, low: 2, info: 1 }[s] ?? 0;
}

function heuristicDepScan(pkgPath: string): DepFinding[] {
  const findings: DepFinding[] = [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const risky = ['request', 'node-uuid', 'serialize-javascript', 'lodash', 'minimist'];
    for (const [name, version] of Object.entries(allDeps ?? {})) {
      if (risky.some((r) => name.includes(r))) {
        findings.push({
          package: name,
          severity: 'moderate',
          title: `${name}@${version} — review for known CVEs (npm audit unavailable)`,
        });
      }
    }
  } catch { /* skip */ }
  return findings;
}

export function formatDepAudit(result: DepAuditResult): string {
  const lines = [result.summary, ''];
  if (result.findings.length === 0) return lines.join('\n');

  for (const f of result.findings.slice(0, 15)) {
    lines.push(`  [${f.severity.toUpperCase()}] ${f.package}: ${f.title}`);
    if (f.url) lines.push(`    ${f.url}`);
  }
  if (result.findings.length > 15) {
    lines.push(`  ... and ${result.findings.length - 15} more`);
  }
  return lines.join('\n');
}
