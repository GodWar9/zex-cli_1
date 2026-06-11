import React from 'react';
import { Box, Text, useStdout } from 'ink';
import { theme } from '../theme.ts';

// Free tier Gemini limit per minute (input tokens).
// Used to calculate % used in the budget bar.
const FREE_TIER_TOKEN_LIMIT = 32_000;
const BAR_WIDTH = 12; // chars wide for the progress fill

type Props = {
  model?: string;
  tokenCount?: number;
  isLoading?: boolean;
  keyPoolSummary?: string;
  planMode?: boolean;
  debugMode?: boolean;
  cacheHitRate?: number;
  budgetWarning?: boolean;
  securityOk?: boolean;
};

function getCwd(): string {
  const cwd = process.cwd();
  const home = process.env['HOME'] ?? '';
  return home ? cwd.replace(home, '~') : cwd;
}

/**
 * Renders a compact token budget bar like: [████████░░░░] 8.4k
 * Color shifts: green → yellow → red as usage climbs.
 */
function TokenBudgetBar({ used }: { used: number }): React.ReactElement {
  const pct = Math.min(1, used / FREE_TIER_TOKEN_LIMIT);
  const filled = Math.round(pct * BAR_WIDTH);
  const empty  = BAR_WIDTH - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const color =
    pct < 0.5  ? theme.colors.success :  // green  — plenty of runway
    pct < 0.8  ? theme.colors.warning :  // amber  — getting tight
                 theme.colors.error;     // red    — almost out

  const label = used >= 1000
    ? `${(used / 1000).toFixed(1)}k`
    : `${used}`;

  return (
    <Box>
      <Text color={theme.colors.dim}>[</Text>
      <Text color={color}>{bar}</Text>
      <Text color={theme.colors.dim}>] </Text>
      <Text color={color}>{label}</Text>
    </Box>
  );
}

export default function StatusBar({
  model = 'no model',
  tokenCount = 0,
  isLoading = false,
  keyPoolSummary,
  planMode = false,
  debugMode = false,
  cacheHitRate = 0,
  budgetWarning = false,
  securityOk = true,
}: Props): React.ReactElement {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const cwd = getCwd();

  // Truncate cwd if terminal is narrow
  const maxCwdLen = Math.max(10, width - 70);
  const displayCwd = cwd.length > maxCwdLen
    ? '…' + cwd.slice(-(maxCwdLen - 1))
    : cwd;

  return (
    <Box marginX={1} marginTop={0} marginBottom={0} justifyContent="space-between">

      {/* LEFT — brand + plan mode indicator */}
      <Box>
        <Text backgroundColor={theme.colors.primary} color={theme.colors.text} bold>
          {' zex '}
        </Text>
        {planMode && (
          <Text color={theme.colors.warning} bold> 📋 PLAN</Text>
        )}
        {debugMode && (
          <Text color={theme.colors.warning} bold> 🔍 DEBUG</Text>
        )}
        {budgetWarning && (
          <Text color={theme.colors.error} bold> 💰 LOW</Text>
        )}
      </Box>

      {/* CENTER — model / thinking indicator */}
      <Box>
        {isLoading ? (
          <Text color={theme.colors.warning}> ◌ thinking… </Text>
        ) : (
          <Text color={theme.colors.textDim}> {model} </Text>
        )}
        {keyPoolSummary && (
          <Text color={theme.colors.dim}>· {keyPoolSummary} </Text>
        )}
      </Box>

      {/* RIGHT — tokens, cache, security, cwd */}
      <Box>
        {tokenCount > 0 && <TokenBudgetBar used={tokenCount} />}
        {cacheHitRate > 0 && (
          <Text color={theme.colors.dim}> · Cache {Math.round(cacheHitRate * 100)}% </Text>
        )}
        <Text color={securityOk ? theme.colors.success : theme.colors.warning}>
          {' '}· Sec {securityOk ? 'OK' : '!'} 
        </Text>
        <Text color={theme.colors.dim}> {displayCwd} </Text>
      </Box>

    </Box>
  );
}
