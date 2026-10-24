import { stopFileWatcher } from '@sahil/zex-core/utils/fileWatcher.ts';
import { gc } from '@sahil/zex-core/agent/gcState.ts';

/** Release terminal-owned handles on unmount and on failed rendering. */
export function disposeTerminalResources(): void {
  stopFileWatcher();
  gc.stopBackgroundEviction();
}
