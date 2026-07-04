// ─── Project Style Guide Extractor ───────────────────────────────────────────
// Detects naming, import, and error-handling conventions from sample files.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export interface StyleGuide {
  namingConvention: string;
  errorHandling: string;
  importStyle: string;
  commentStyle: string;
}

let _cached: StyleGuide | null = null;

function sampleFiles(root: string, limit = 15): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    if (out.length >= limit) return;
    try {
      for (const e of readdirSync(dir)) {
        if (out.length >= limit) break;
        if (e.startsWith('.') || e === 'node_modules') continue;
        const full = join(dir, e);
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (['.ts', '.tsx', '.js'].includes(extname(e))) out.push(full);
      }
    } catch { /* skip */ }
  }
  walk(root);
  return out;
}

export function analyzeProjectStyle(projectRoot = process.cwd()): StyleGuide {
  if (_cached) return _cached;

  const files = sampleFiles(projectRoot);
  let esm = 0;
  let cjs = 0;
  let camel = 0;
  let snake = 0;
  let tryCatch = 0;
  let throwErr = 0;
  let jsdoc = 0;

  for (const f of files) {
    try {
      const c = readFileSync(f, 'utf-8');
      if (/import\s+/.test(c)) esm++;
      if (/require\s*\(/.test(c)) cjs++;
      if (/const\s+[a-z][a-zA-Z0-9]*/.test(c)) camel++;
      if (/const\s+[a-z]+_[a-z]/.test(c)) snake++;
      if (/try\s*\{/.test(c)) tryCatch++;
      if (/throw\s+new/.test(c)) throwErr++;
      if (/\/\*\*/.test(c)) jsdoc++;
    } catch { /* skip */ }
  }

  _cached = {
    namingConvention: camel >= snake ? 'camelCase' : 'snake_case',
    errorHandling: tryCatch >= throwErr ? 'try/catch' : 'throw errors',
    importStyle: esm >= cjs ? 'ES modules (import/export)' : 'CommonJS (require)',
    commentStyle: jsdoc > 2 ? 'JSDoc blocks' : 'inline comments',
  };
  return _cached;
}

export function styleGuidePrompt(): string {
  const g = analyzeProjectStyle();
  return [
    'PROJECT CONVENTIONS (auto-detected):',
    `- Variables: ${g.namingConvention}`,
    `- Error handling: ${g.errorHandling}`,
    `- Imports: ${g.importStyle}`,
    `- Comments: ${g.commentStyle}`,
  ].join('\n');
}
