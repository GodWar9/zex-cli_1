import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
const name = `dist/zex-${process.platform}-${process.arch}${process.platform === 'win32' ? '.exe' : ''}`;
const result = spawnSync('bun', ['build', 'packages/cli/src/index.tsx', '--compile', '--outfile', name], { stdio: 'inherit', shell: false });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
