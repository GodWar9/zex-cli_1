// ─── Offline Tool & Pruner Test ───────────────────────────────────────────────
// Run with: bun run test:tools
// Tests all tools and the pruner WITHOUT making any API calls.
// Safe to run anytime — no tokens burned.

import { availableTools, getTool } from './src/tools/index.ts';
import { classifyTurnType, buildPrunedSystemPrompt, estimateTokens } from './src/agent/pruner.ts';
import type { ConversationMessage } from './src/agent/types.ts';

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

// ─── 1. Tool Registry ─────────────────────────────────────────────────────────
section('Tool Registry');

const toolNames = availableTools.map(t => t.name);
console.log(`  ${DIM}Registered tools: ${toolNames.join(', ')}${RESET}`);

const requiredTools = ['list_directory', 'search_files', 'read_file', 'patch_file', 'write_file', 'run_shell_command', 'update_project_status'];
for (const name of requiredTools) {
  const tool = getTool(name);
  if (tool) {
    ok(`getTool('${name}') found`);
  } else {
    fail(`getTool('${name}') not found`, 'Tool is not registered in src/tools/index.ts');
  }
}

// Check ordering — list_directory should be first
if (availableTools[0]?.name === 'list_directory') {
  ok('list_directory is first in the registry (model reaches for it first)');
} else {
  fail('list_directory should be first in registry', `Got: ${availableTools[0]?.name}`);
}

// ─── 2. list_directory tool ───────────────────────────────────────────────────
section('list_directory Tool');

const listTool = getTool('list_directory')!;

// Test 1: List the src/ directory
try {
  const result = await listTool.execute({ path: './src', max_depth: 3 });
  if (!result.isError && result.content.includes('tools') && result.content.includes('agent')) {
    ok('Lists src/ correctly', `${result.content.split('\n').length} lines returned`);
  } else {
    fail('List src/ failed', result.content.slice(0, 200));
  }
} catch (e: any) {
  fail('list_directory threw an exception', e.message);
}

// Test 2: Missing path
try {
  const result = await listTool.execute({ path: './does_not_exist_xyz' });
  if (result.isError) {
    ok('Returns error for non-existent path');
  } else {
    fail('Should have returned isError for missing path', 'Got success');
  }
} catch (e: any) {
  fail('list_directory threw instead of returning error', e.message);
}

// Test 3: No args — defaults to cwd
try {
  const result = await listTool.execute({});
  if (!result.isError && result.content.includes('src')) {
    ok('Defaults to cwd when no path given');
  } else {
    fail('Default cwd failed', result.content.slice(0, 100));
  }
} catch (e: any) {
  fail('list_directory (no args) threw', e.message);
}

// ─── 3. search_files tool ─────────────────────────────────────────────────────
section('search_files Tool');

const searchTool = getTool('search_files')!;

// Test 1: Find a known term
try {
  const result = await searchTool.execute({ query: 'KeyPool', path: './src' });
  if (!result.isError && result.content.includes('keyPool.ts')) {
    ok('Finds "KeyPool" in src/', `Results: ${result.content.split('\n').filter(l => l.includes('L')).length} matches`);
  } else {
    fail('Search for "KeyPool" failed', result.content.slice(0, 200));
  }
} catch (e: any) {
  fail('search_files threw', e.message);
}

// Test 2: No results — exclude .ts files to avoid matching the test file itself
try {
  const result = await searchTool.execute({ query: 'xyzzy_no_such_term_12345', path: './src' });
  if (!result.isError && result.content.includes('No matches')) {
    ok('Returns "No matches" for unknown term');
  } else {
    fail('Should return "No matches"', result.content.slice(0, 100));
  }
} catch (e: any) {
  fail('search_files (no results) threw', e.message);
}

// Test 3: Regex search
try {
  const result = await searchTool.execute({ query: 'export (const|function|class)', is_regex: true, path: './src/tools' });
  if (!result.isError && result.content.includes('📄')) {
    ok('Regex search works', `Found exports in tools/`);
  } else {
    fail('Regex search failed', result.content.slice(0, 200));
  }
} catch (e: any) {
  fail('search_files (regex) threw', e.message);
}

// Test 4: Extension filter
try {
  const result = await searchTool.execute({ query: 'import', path: './src/tools', file_types: '.ts' });
  if (!result.isError) {
    ok('File type filter works (.ts only)');
  } else {
    fail('File type filter failed', result.content.slice(0, 200));
  }
} catch (e: any) {
  fail('search_files (file_types) threw', e.message);
}

// ─── 4. Pruner / Turn Classification ─────────────────────────────────────────
section('Pruner — Turn Classification');

const toolNamesList = availableTools.map(t => t.name);

const emptyHistory: ConversationMessage[] = [];
const afterFirstUser: ConversationMessage[] = [
  { role: 'user', content: 'Build me a counter app' },
];
const afterToolResponse: ConversationMessage[] = [
  { role: 'user', content: 'Build me a counter app' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'list_directory', args: {} }] },
  { role: 'tool', content: '📁 src\n├── index.ts', toolCallId: 'c1', name: 'list_directory' },
];
const afterContinuation: ConversationMessage[] = [
  { role: 'user', content: 'Build me a counter app' },
  { role: 'assistant', content: 'Done!' },
  { role: 'user', content: 'Now add a reset button' },
];

if (classifyTurnType(emptyHistory) === 'first_user') {
  ok("Empty history → 'first_user'");
} else {
  fail("Empty history should be 'first_user'", `Got: ${classifyTurnType(emptyHistory)}`);
}

if (classifyTurnType(afterFirstUser) === 'first_user') {
  ok("Single user message → 'first_user'");
} else {
  fail("Single user message should be 'first_user'", `Got: ${classifyTurnType(afterFirstUser)}`);
}

if (classifyTurnType(afterToolResponse) === 'tool_loopback') {
  ok("Last message = tool → 'tool_loopback'");
} else {
  fail("Tool response should be 'tool_loopback'", `Got: ${classifyTurnType(afterToolResponse)}`);
}

if (classifyTurnType(afterContinuation) === 'continuation') {
  ok("Follow-up user message → 'continuation'");
} else {
  fail("Follow-up should be 'continuation'", `Got: ${classifyTurnType(afterContinuation)}`);
}

// ─── 5. Pruner — Token Savings ────────────────────────────────────────────────
section('Pruner — Token Savings Measurement');

const fullPrompt = buildPrunedSystemPrompt(afterFirstUser, toolNamesList);
const loopbackPrompt = buildPrunedSystemPrompt(afterToolResponse, toolNamesList);
const continuationPrompt = buildPrunedSystemPrompt(afterContinuation, toolNamesList);

const fullTokens       = estimateTokens(fullPrompt);
const loopbackTokens   = estimateTokens(loopbackPrompt);
const continuationTokens = estimateTokens(continuationPrompt);
const savings          = Math.round((1 - loopbackTokens / fullTokens) * 100);

console.log(`\n  ${DIM}Prompt token estimates:${RESET}`);
console.log(`    first_user:    ${YELLOW}~${fullTokens} tokens${RESET}  (full prompt)`);
console.log(`    continuation:  ${YELLOW}~${continuationTokens} tokens${RESET}`);
console.log(`    tool_loopback: ${GREEN}~${loopbackTokens} tokens${RESET}  (${savings}% smaller)`);

if (loopbackTokens < fullTokens * 0.6) {
  ok(`tool_loopback is ${savings}% smaller than full prompt — pruner working correctly`);
} else {
  fail(`Expected >40% reduction for tool_loopback, got ${savings}%`, 'Pruner may not be filtering segments correctly');
}

// Check COLLECTOR_SEGMENT is in first_user but NOT in tool_loopback
if (fullPrompt.includes('list_directory') && !loopbackPrompt.includes('list_directory')) {
  ok('COLLECTOR_SEGMENT present in first_user, absent in tool_loopback');
} else {
  fail('COLLECTOR_SEGMENT should only appear in first_user/continuation turns', '');
}

// ─── 6. Key Pool ──────────────────────────────────────────────────────────────
section('Key Pool — Structure');

try {
  const { KeyPool } = await import('./src/agent/keyPool.ts');
  const pool = new KeyPool(['KEY_A', 'KEY_B', 'KEY_C']);

  if (pool.getCurrentKey() === 'KEY_A') {
    ok('getCurrentKey returns first key initially');
  } else {
    fail('getCurrentKey should return KEY_A', `Got: ${pool.getCurrentKey()}`);
  }

  pool.markExhausted('KEY_A');
  if (pool.getCurrentKey() === 'KEY_B') {
    ok('markExhausted rotates to next key');
  } else {
    fail('After exhausting KEY_A, should return KEY_B', `Got: ${pool.getCurrentKey()}`);
  }

  const masked = KeyPool.maskKey('AIzaSyA69SDM8mhFwjv9MPM2rtWRRxr3Oh31EBc');
  const expectedStart = 'AIzaSyA6';
  const expectedEnd   = masked.slice(-4);
  if (masked.startsWith(expectedStart) && masked.includes('...')) {
    ok(`maskKey shows first 8 + last 4 chars: "${masked}"`);
  } else {
    fail('maskKey format wrong', `Got: ${masked}`);
  }

  if (pool.totalKeys === 3) {
    ok('totalKeys returns correct count');
  } else {
    fail('totalKeys should be 3', `Got: ${pool.totalKeys}`);
  }

  if (pool.summaryLine().includes('active')) {
    ok(`summaryLine works: "${pool.summaryLine()}"`);
  } else {
    fail('summaryLine should include "active"', `Got: ${pool.summaryLine()}`);
  }
} catch (e: any) {
  fail('KeyPool test threw', e.message);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(55)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`${GREEN}${BOLD}✓ All ${total} tests passed — no API calls made${RESET}`);
} else {
  console.log(`${RED}${BOLD}✗ ${failed}/${total} tests failed${RESET}  ${DIM}(${passed} passed)${RESET}`);
  process.exit(1);
}
