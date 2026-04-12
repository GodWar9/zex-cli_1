import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.ts';

// A single message bubble.
// role = 'user' | 'assistant' | 'system'
export type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type Props = {
  messages: Message[];
  /** When true, shows a blinking cursor at the end of the last assistant message */
  isStreaming?: boolean;
};

function MessageRow({
  message,
  showCursor,
}: {
  message: Message;
  showCursor: boolean;
}) {
  const isUser = message.role === 'user';
  const symbol = isUser ? theme.symbols.user : theme.symbols.assistant;
  const color  = isUser ? theme.colors.user  : theme.colors.assistant;
  const label  = isUser ? 'you'              : 'zex';

  if (message.role === 'system') {
    return (
      <Box paddingX={2} paddingY={0}>
        <Text color={theme.colors.dim} dimColor>
          {theme.symbols.separator} {message.content}
        </Text>
      </Box>
    );
  }

  // Parse thought block if it exists
  let thoughtText = '';
  let mainText = message.content;
  let isInsideThought = false;

  if (!isUser) {
    const thoughtTagMatch = message.content.match(/<(thinking|thought)>/);
    if (thoughtTagMatch) {
      const startTag = thoughtTagMatch[0];
      const endTag = `</${thoughtTagMatch[1]}>`;
      
      const startIndex = thoughtTagMatch.index!;
      const startOfThought = startIndex + startTag.length;
      const endIndex = message.content.indexOf(endTag, startOfThought);
      
      const textBefore = message.content.substring(0, startIndex);
      
      if (endIndex === -1) {
        // Still streaming the thought
        thoughtText = message.content.substring(startOfThought).trimStart();
        mainText = textBefore;
        isInsideThought = true;
      } else {
        // Thought block closed
        thoughtText = message.content.substring(startOfThought, endIndex).trim();
        mainText = textBefore + message.content.substring(endIndex + endTag.length).trimStart();
      }
    }
  }

  // Show animated thinking indicator when streaming and content is empty
  // Or when we are actively inside a streaming thought block
  const isWaitingForFirstToken = !isUser && showCursor && message.content === '';
  const isThinkingState = isWaitingForFirstToken || (isInsideThought && showCursor);

  return (
    <Box flexDirection="column" paddingX={2} paddingBottom={1}>
      {/* Label row */}
      <Box>
        <Text color={color} bold>
          {isThinkingState ? theme.symbols.thinking : symbol} {label}
        </Text>
        {isThinkingState && (
          <Text color={theme.colors.warning}> thinking…</Text>
        )}
      </Box>
      
      {/* Content row — indented to align with label */}
      {(thoughtText.length > 0 || mainText.length > 0) && (
        <Box paddingLeft={2} flexDirection="column">
          {/* Thought box */}
          {thoughtText.length > 0 && (
            <Box paddingBottom={mainText.length > 0 ? 1 : 0} borderStyle="single" borderColor={theme.colors.dim} paddingX={1}>
              <Text color={theme.colors.dim} wrap="wrap">
                {thoughtText}
                {isInsideThought && showCursor && <Text color={theme.colors.accent}>▋</Text>}
              </Text>
            </Box>
          )}
          
          {/* Main output */}
          {mainText.length > 0 && (
            <Box>
              <Text color={theme.colors.text} wrap="wrap">
                {mainText}
                {!isInsideThought && showCursor && !isUser && (
                  <Text color={theme.colors.accent}>▋</Text>
                )}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function MessageList({ messages, isStreaming = false }: Props) {
  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text color={theme.colors.dim}>
          Ask anything. Press{' '}
          <Text color={theme.colors.accent}>Enter</Text>
          {' '}to send,{' '}
          <Text color={theme.colors.accent}>Ctrl+C</Text>
          {' '}to quit.
        </Text>
      </Box>
    );
  }

  const lastIdx = messages.length - 1;

  return (
    <Box flexDirection="column" flexGrow={1} paddingTop={1}>
      {messages.map((msg, idx) => (
        <MessageRow
          key={msg.id}
          message={msg}
          showCursor={isStreaming && idx === lastIdx && msg.role === 'assistant'}
        />
      ))}
    </Box>
  );
}
