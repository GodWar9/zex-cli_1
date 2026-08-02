import { realpath, open } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';

// 10 MB limits
export const MAX_READ_SIZE = 10 * 1024 * 1024;
export const MAX_WRITE_SIZE = 10 * 1024 * 1024;

export async function validateWorkspaceBoundary(targetPath: string): Promise<string> {
  const cwd = process.cwd();
  const absoluteTarget = resolve(cwd, targetPath);

  let realTarget;
  try {
    realTarget = await realpath(absoluteTarget);
  } catch (e: unknown) {
    // If the file (or any number of its parent directories) doesn't exist
    // yet, walk up until we find the nearest existing ancestor, validate
    // *that* is within the workspace, then rebuild the intended path from
    // there. This supports creating files in brand-new nested directories.
    if ((e as any)?.code === 'ENOENT') {
      let dir = resolve(absoluteTarget, '..');
      const relativeParts: string[] = [];
      // Cap the walk so a pathological input can't loop forever.
      for (let i = 0; i < 64; i++) {
        try {
          const realDir = await realpath(dir);
          realTarget = join(realDir, ...relativeParts, basename(absoluteTarget));
          break;
        } catch (inner: unknown) {
          if ((inner as any)?.code !== 'ENOENT') throw inner;
          relativeParts.unshift(basename(dir));
          const parent = resolve(dir, '..');
          if (parent === dir) throw inner; // reached filesystem root, give up
          dir = parent;
        }
      }
      if (!realTarget) throw e;
    } else {
      throw e;
    }
  }

  const realCwd = await realpath(cwd);

  if (!realTarget.startsWith(realCwd)) {
    throw new Error(`Path ${targetPath} escapes the workspace boundary (${realCwd}).`);
  }

  return realTarget;
}

export async function isBinaryFile(filePath: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(filePath, 'r');
  } catch {
    return false;
  }
  try {
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, 8192, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } finally {
    await handle.close();
  }
}
