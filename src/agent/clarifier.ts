// ─── Intent Clarifier ─────────────────────────────────────────────────────────
// Runs before the main agent call on every user message.
// Cheap: uses max_tokens: 300.
// Returns structured intent or passthrough if input is already specific.
//
// This uses the same provider/key infrastructure as the main agent — no
// hardcoded API keys, no new HTTP client.

import { loadConfig } from '../config/index.ts';
import { getProvider } from './providers/index.ts';
import type { ConversationMessage } from './types.ts';

export interface ClarifiedIntent {
  primaryGoal: string;
  likelyFiles: string[];
  securitySensitive: boolean; // true if touches auth, db, filesystem, network, env vars
  isClear: boolean;           // if true, original message was already specific
  originalMessage: string;
}

const CLARIFIER_SYSTEM_PROMPT = `You are a developer intent parser. Given a vague or specific coding request, extract structured intent.
Output ONLY a JSON object with these fields:
{
  "primaryGoal": "one sentence describing what the developer wants",
  "likelyFiles": ["array of file paths likely involved, empty if unknown"],
  "securitySensitive": true,
  "isClear": true
}
Where securitySensitive is true if the task touches: auth, sessions, passwords, database queries, file system access, environment variables, network requests, cryptography.
And isClear is false only if the original request is genuinely ambiguous/vague.
No preamble, no explanation, just the JSON object.`;

/** Fallback intent used if the API call fails or times out */
function fallbackIntent(userMessage: string): ClarifiedIntent {
  return {
    primaryGoal: userMessage,
    likelyFiles: [],
    securitySensitive: false,
    isClear: true,
    originalMessage: userMessage,
  };
}

/**
 * Extracts structured intent from a user message using a short, cheap LLM call.
 * Uses the same configured provider as the main agent — no extra API key needed.
 *
 * @param userMessage       The raw user input
 * @param projectContext    Brief project summary (framework, main dirs) for grounding
 */
export async function clarifyIntent(
  userMessage: string,
  projectContext: string,
): Promise<ClarifiedIntent> {
  // Short-circuit for very short, specific-looking messages to save tokens
  if (userMessage.length < 20) {
    return fallbackIntent(userMessage);
  }

  const config = loadConfig();
  const provider = getProvider(config.provider.provider);

  const messages: ConversationMessage[] = [
    {
      role: 'user',
      content: `Project context: ${projectContext}\n\nUser request: ${userMessage}`,
    },
  ];

  let jsonBuffer = '';

  try {
    // Run the LLM call with a hard token cap of 300 — we only need a JSON snippet
    const clarifierConfig = {
      ...config.provider,
      maxTokens: 300,
      temperature: 0,
      systemPrompt: CLARIFIER_SYSTEM_PROMPT,
    };

    for await (const chunk of provider.stream(messages, clarifierConfig)) {
      if (chunk.type === 'delta') {
        jsonBuffer += chunk.text;
        // Early exit: once we see the closing brace, the JSON is complete
        if (jsonBuffer.trimEnd().endsWith('}')) break;
      }
      if (chunk.type === 'error') {
        // Gracefully degrade — don't block the main agent call
        return fallbackIntent(userMessage);
      }
    }

    // Parse the JSON response
    const trimmed = jsonBuffer.trim();
    // Extract just the JSON object in case model wrapped it in markdown code fences
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackIntent(userMessage);

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ClarifiedIntent>;

    return {
      primaryGoal: parsed.primaryGoal ?? userMessage,
      likelyFiles: Array.isArray(parsed.likelyFiles) ? parsed.likelyFiles : [],
      securitySensitive: parsed.securitySensitive === true,
      isClear: parsed.isClear !== false, // default to true (specific) if omitted
      originalMessage: userMessage,
    };
  } catch {
    // Never block the main agent turn due to clarifier failure
    return fallbackIntent(userMessage);
  }
}
