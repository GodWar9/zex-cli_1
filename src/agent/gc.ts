import type { ConversationMessage } from './types.ts';

/**
 * Returns a new array with old, massive tool payloads compressed to save tokens.
 * This prevents the context window from filling up with 100kb of terminal outputs.
 */
export function compressHistory(messages: ConversationMessage[], maxTokens?: number): ConversationMessage[] {
  let userMessagesCount = 0;
  for (const msg of messages) {
    if (msg.role === 'user') {
      userMessagesCount++;
    }
  }

  let userTurnsSeen = 0;
  
  return messages.map((msg) => {
    if (msg.role === 'user') {
      userTurnsSeen++;
    }
    
    // Determine how old this message is in terms of user turns
    const userTurnsAgo = userMessagesCount - userTurnsSeen;
    const isOldTurn = userTurnsAgo >= 2;

    if (isOldTurn && msg.role === 'tool' && msg.content && msg.content.length > 800) {
      return {
        ...msg,
        content: `[System: Heavy payload compressed to save tokens. Tool execution was successful.]`
      };
    }

    return msg;
  });
}
