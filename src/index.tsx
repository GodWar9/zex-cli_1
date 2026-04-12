import React from 'react';
import { render } from 'ink';
import App from './tui/App.tsx';

// Enter alternate screen before mounting — same as vim/less/htop.
// This keeps zex from polluting the shell's scroll history.
process.stdout.write('\x1b[?1049h'); // enter alternate screen
process.stdout.write('\x1b[2J');      // clear screen
process.stdout.write('\x1b[H');       // cursor to top-left

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: true,
});

await waitUntilExit();

// Leave alternate screen on exit — restores whatever was in the terminal before.
process.stdout.write('\x1b[?1049l');
