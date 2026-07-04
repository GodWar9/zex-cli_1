import React from 'react';
import { Box, Text } from 'ink';
import ChatScreen from './screens/ChatScreen.tsx';
import { useTerminalSize } from './hooks/useTerminalSize.ts';
import { theme } from './theme.ts';

const MIN_COLS = 80;
const MIN_ROWS = 24;

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override componentDidCatch(error: Error) {
    console.error('[zex] TUI render error:', error);
  }
  override render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={theme.colors.error} bold>Fatal UI Error</Text>
          <Text color={theme.colors.dim}>zex encountered an unrecoverable render error. Please restart.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

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
  const { cols, rows } = useTerminalSize();

  if (cols < MIN_COLS || rows < MIN_ROWS) {
    return <TooSmall cols={cols} rows={rows} />;
  }

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      <ErrorBoundary>
        <ChatScreen />
      </ErrorBoundary>
    </Box>
  );
}
