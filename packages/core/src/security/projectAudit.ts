// ─── Project Audit ────────────────────────────────────────────────────────────
// Runs once at session start to build a SecurityContext about the project.
// Scans package.json for framework/auth/db detection and shallowly scans
// source files for pre-existing vulnerability patterns.
// Capped at 50 files, top 2 directory levels only — completes in < 500ms.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { scanCode, type SecurityFinding } from './scanner.ts';

export interface SecurityContext {
  framework: string;        // 'next' | 'express' | 'fastapi' | 'unknown'
  hasAuth: boolean;         // passport, next-auth, jsonwebtoken, etc.
  hasDatabase: boolean;     // pg, mysql2, mongoose, prisma, drizzle, etc.
  hasFileSystemAccess: boolean;
  existingFindings: SecurityFinding[];
}

const AUTH_LIBS = new Set([
  'passport', 'passport-local', 'passport-jwt', 'next-auth',
  'jsonwebtoken', 'jwt-simple', 'express-jwt', 'lucia', 'clerk',
  'auth0', 'supertokens', 'iron-session',
]);

const DB_LIBS = new Set([
  'pg', 'mysql2', 'mysql', 'sqlite3', 'better-sqlite3',
  'mongoose', 'mongodb', 'prisma', '@prisma/client',
  'drizzle-orm', 'typeorm', 'sequelize', 'knex',
  'redis', 'ioredis',
]);

const FS_LIBS = new Set([
  'fs-extra', 'graceful-fs', 'chokidar', 'glob', 'fast-glob', 'node:fs',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '__pycache__',
  'coverage', '.turbo', 'vendor',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.php', '.go', '.java', '.rs',
]);

/** Detect framework from package.json dependencies */
function detectFramework(deps: Record<string, string>): string {
  if ('next' in deps) return 'next';
  if ('express' in deps) return 'express';
  if ('fastify' in deps) return 'fastify';
  if ('koa' in deps) return 'koa';
  if ('hono' in deps) return 'hono';
  return 'unknown';
}

/** Collect source files up to depth 2, capped at 50 */
function collectFiles(dir: string, depth: number, files: string[]): void {
  if (depth > 2 || files.length >= 50) return;

  let items: string[];
  try { items = readdirSync(dir); } catch { return; }

  for (const item of items) {
    if (files.length >= 50) break;
    if (SKIP_DIRS.has(item) || item.startsWith('.')) continue;

    const fullPath = join(dir, item);
    let stat;
    try { stat = statSync(fullPath); } catch { continue; }

    if (stat.isDirectory()) {
      collectFiles(fullPath, depth + 1, files);
    } else if (TEXT_EXTENSIONS.has(extname(item).toLowerCase())) {
      files.push(fullPath);
    }
  }
}

/**
 * Audits the project at rootPath to build a SecurityContext.
 * Reads package.json for dependency analysis and shallowly scans src/ for patterns.
 *
 * @param rootPath  Absolute path to the project root
 */
export async function auditProject(rootPath: string): Promise<SecurityContext> {
  let framework = 'unknown';
  let hasAuth = false;
  let hasDatabase = false;
  let hasFileSystemAccess = false;
  const existingFindings: SecurityFinding[] = [];

  // ── Parse package.json ──────────────────────────────────────────────────────
  const pkgPath = join(rootPath, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const allDeps: Record<string, string> = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };

      framework = detectFramework(allDeps);

      for (const dep of Object.keys(allDeps)) {
        if (AUTH_LIBS.has(dep)) hasAuth = true;
        if (DB_LIBS.has(dep)) hasDatabase = true;
        if (FS_LIBS.has(dep)) hasFileSystemAccess = true;
      }
    } catch {
      // Malformed package.json — continue with defaults
    }
  }

  // ── Shallow file scan for pre-existing vulnerabilities ─────────────────────
  const srcDir = join(rootPath, 'src');
  const scanRoot = existsSync(srcDir) ? srcDir : rootPath;

  const filesToScan: string[] = [];
  collectFiles(scanRoot, 0, filesToScan);

  for (const filePath of filesToScan) {
    try {
      const code = readFileSync(filePath, 'utf-8');
      const findings = scanCode(code);
      existingFindings.push(...findings);
    } catch {
      // Skip unreadable files
    }

    if (existingFindings.length >= 100) break; // Cap total findings
  }

  return {
    framework,
    hasAuth,
    hasDatabase,
    hasFileSystemAccess,
    existingFindings,
  };
}
