import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

// ASCII art for "zex" — shown once at launch, like Claude Code's header.
const LOGO = [
  ' ███████╗███████╗██╗  ██╗',
  '    ███╔╝██╔════╝╚██╗██╔╝',
  '   ███╔╝ █████╗   ╚███╔╝ ',
  '  ███╔╝  ██╔══╝   ██╔██╗ ',
  ' ███████╗███████╗██╔╝ ██╗',
  ' ╚══════╝╚══════╝╚═╝  ╚═╝',
];

const TAGLINE = 'safe vibe coding  ·  context-aware  ·  token-efficient';

export default function Banner() {
  return (
    <Box flexDirection="column" alignItems="center" paddingTop={1} paddingBottom={1}>
      {LOGO.map((line, i) => (
        <Text key={i} color={theme.colors.primary} bold>
          {line}
        </Text>
      ))}
      <Box marginTop={1}>
        <Text color={theme.colors.dim}>{TAGLINE}</Text>
      </Box>
    </Box>
  );
}
