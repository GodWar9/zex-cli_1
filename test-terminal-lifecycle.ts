import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';

test('terminal disposal closes real file watchers and timers so the process exits naturally', () => {
  const parent = realpathSync(tmpdir());
  const directory = mkdtempSync(join(parent, 'zex-lifecycle-'));
  try {
    const watcher = new URL('./packages/core/src/utils/fileWatcher.ts', import.meta.url).href;
    const collector = new URL('./packages/core/src/agent/gcState.ts', import.meta.url).href;
    const lifecycle = new URL('./packages/cli/src/terminal-lifecycle.ts', import.meta.url).href;
    const source = `import { startFileWatcher } from ${JSON.stringify(watcher)};
import { gc } from ${JSON.stringify(collector)};
import { disposeTerminalResources } from ${JSON.stringify(lifecycle)};
startFileWatcher(${JSON.stringify(directory)});
gc.startBackgroundEviction(20);
setTimeout(() => { disposeTerminalResources(); disposeTerminalResources(); console.log('disposed'); }, 50);`;
    const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', source], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /disposed/);
  } finally {
    assert.equal(dirname(directory), parent); assert.ok(basename(directory).startsWith('zex-lifecycle-'));
    rmSync(directory, { recursive: true, force: true });
  }
});
