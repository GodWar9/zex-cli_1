import React from 'react';
import { Box, Text } from 'ink';
import ChatScreen from './screens/ChatScreen.tsx';
import { useTerminalSize } from './hooks/useTerminalSize.ts';
import { theme } from './theme.ts';

const MIN_COLS = 80;
const MIN_ROWS = 24;

function TooSmall({ cols, rows }: { cols: number; rows: number }) {
  return (
    <Box
      width={cols}
      height={rows}
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
    >
      <Text color={theme.colors.error} bold>Terminal too small</Text>
      <Text color={theme.colors.dim}>
        Current: {cols}×{rows}{'  '}Required: {MIN_COLS}×{MIN_ROWS}
      </Text>
      <Text color={theme.colors.dim}>Resize your terminal to continue.</Text>
    </Box>
  );
}

export default function App() {
  // Re-renders on every resize event via the listener in useTerminalSize.
  const { cols, rows } = useTerminalSize();

  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return <TooSmall cols={cols} rows={rows} />;
  }

  return (
    // width + height pinned to live terminal dims — layout reflows on resize.
    <Box flexDirection="column" width={cols} height={rows}>
      <ChatScreen />
    </Box>
  );
}
