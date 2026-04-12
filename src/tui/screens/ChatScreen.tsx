import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Banner from '../components/Banner.tsx';
import MessageList, { type Message } from '../components/MessageList.tsx';
import InputBox from '../components/InputBox.tsx';
import StatusBar from '../components/StatusBar.tsx';
import { runTurn, type ConversationMessage } from '../../agent/runner.ts';
import { getActiveModelLabel, loadConfig, reloadConfig } from '../../config/index.ts';
import { parseSlashCommand, buildHelpMessage } from '../slashCommands.ts';
import { undoStack } from '../../session/undoStack.ts';
import { saveSession, loadLastSession, generateSessionId } from '../../session/store.ts';
import { getSecuritySummary, logSecurityEvent } from '../../security/eventLog.ts'; // zex: added for security-layer
import { auditProject } from '../../security/projectAudit.ts'; // zex: added for security-layer
import { join } from 'node:path';

let msgCounter = 0;
const nextId = () => String(++msgCounter);

// ─── Plan-mode injection ───────────────────────────────────────────────────────
// When plan mode is ON, prepend this to every user message so the agent
// proposes a numbered plan and waits for approval before touching files.
const PLAN_MODE_PREFIX =
  'IMPORTANT: Before doing anything, write a clear numbered plan of every step you are going to take (files to create/edit, commands to run, etc.). ' +
  'Wait for me to say "proceed" or "yes" before actually executing the plan. Do NOT call any tools until I approve.';

export default function ChatScreen() {
  const { exit } = useApp();

  const [messages, setMessages]       = useState<Message[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [tokenCount, setTokenCount]   = useState(0);
  const [modelLabel, setModelLabel]   = useState(() => getActiveModelLabel());
  const [planMode, setPlanMode]       = useState(false);
  const [logsEnabled, setLogsEnabled] = useState(false);
  const [keyPoolSummary, setKeyPoolSummary] = useState<string | undefined>(undefined);
  const [sessionId] = useState(() => generateSessionId());

  const [pendingTool, setPendingTool] = useState<{
    name: string;
    args: any;
    resolve: (b: boolean) => void;
  } | null>(null);

  const streamingMsgId = useRef<string | null>(null);
  const historyRef     = useRef<ConversationMessage[]>([]);
  const auditDone      = useRef(false); // zex: added for security-layer

  // ── Project Security Audit (zex: added for security-layer) ──────────────────
  useEffect(() => {
    if (auditDone.current) return;
    auditDone.current = true;

    async function runAudit() {
      const root = process.cwd();
      const context = await auditProject(root);

      // Log existing findings to the security log
      for (const finding of context.existingFindings) {
        logSecurityEvent({
          turn: 0,
          tool: 'audit',
          file: 'pre-existing',
          finding,
          action: 'logged',
          timestamp: new Date(),
        });
      }

      setMessages(prev => [
        ...prev,
        {
          id: nextId(),
          role: 'system',
          content: `🔍 [Security Audit] Tech: ${context.framework} | Auth: ${context.hasAuth ? 'Yes' : 'No'} | DB: ${context.hasDatabase ? 'Yes' : 'No'}\n${context.existingFindings.length > 0 ? `⚠ Found ${context.existingFindings.length} pre-existing security concerns (run /security to view).` : '✅ No immediate security concerns found.'}`
        }
      ]);
    }

    runAudit();
  }, []);

  // ── Tool permission gate (Y / n) ────────────────────────────────────────────
  useInput((input, key) => {
    if (pendingTool) {
      if (input.toLowerCase() === 'y' || key.return) {
        setPendingTool(null);
        pendingTool.resolve(true);
      } else if (input.toLowerCase() === 'n') {
        setPendingTool(null);
        pendingTool.resolve(false);
      }
    }
  }, { isActive: !!pendingTool });

  // ── Slash command handler ────────────────────────────────────────────────────
  const handleSlashCommand = useCallback((input: string): boolean => {
    const result = parseSlashCommand(input);
    if (result.type === 'not_a_command') return false;

    const systemId = nextId();

    switch (result.type) {
      case 'clear':
        historyRef.current = [];
        setMessages([]);
        setTokenCount(0);
        setMessages([{
          id: nextId(),
          role: 'system',
          content: '🧹 Conversation cleared.',
        }]);
        break;

      case 'keys': {
        // Import dynamically to read live pool state
        import('../../agent/keyPool.ts').then(({ KeyPool }) => {
          try {
            const pool = KeyPool.fromEnv();
            const status = pool.status();
            const lines = [
              `🔑 Key Pool Status  (${pool.totalKeys} total)`,
              '',
              ...status.map((s, i) =>
                `  ${String(i + 1).padStart(2)}. ${s.masked}  [${s.state.toUpperCase()}]${s.cooldownEndsAt ? `  ~${Math.ceil((s.cooldownEndsAt - Date.now()) / 1000)}s cooldown` : ''}  errors: ${s.errorCount}`
              ),
            ];
            setMessages(prev => [...prev, {
              id: systemId, role: 'system', content: lines.join('\n'),
            }]);
          } catch (e: any) {
            setMessages(prev => [...prev, {
              id: systemId, role: 'system', content: `⚠ Key pool error: ${e.message}`,
            }]);
          }
        });
        break;
      }

      case 'plan':
        setPlanMode(prev => {
          const next = !prev;
          setMessages(m => [...m, {
            id: systemId,
            role: 'system',
            content: next
              ? '📋 Plan mode ON — agent will propose a plan before executing.'
              : '📋 Plan mode OFF — agent acts directly.',
          }]);
          return next;
        });
        break;

      case 'logs':
        setLogsEnabled(result.enable);
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: result.enable ? '✅ Background tool logs visibility enabled.' : '❌ Background tool logs hidden.'
        }]);
        break;

      case 'undo': {
        const preview = undoStack.peekDescription();
        if (!preview) {
          setMessages(prev => [...prev, {
            id: systemId, role: 'system', content: '⚠ Nothing to undo.',
          }]);
          break;
        }
        const result = undoStack.undo();
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `↩ Undone: ${result}`,
        }]);
        break;
      }

      case 'model': {
        // Write new model to in-process config override
        // (user needs to restart for ~/.zex/config.json changes, but in-session we patch)
        setMessages(prev => [...prev, {
          id: systemId, role: 'system',
          content: `⚠ Model switching mid-session is not yet supported. Edit ~/.zex/config.json and restart.\nWanted: ${result.modelName}`,
        }]);
        break;
      }

      case 'help': {
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: buildHelpMessage(),
        }]);
        break;
      }

      case 'resume': {
        const last = loadLastSession();
        if (last && last.length > 0) {
          historyRef.current = last;
          
          const loadedMsgs = last.flatMap(m => {
            const arr: Message[] = [];
            // Handle assistant content + tool calls
            if (m.content) {
              arr.push({ id: nextId(), role: m.role as any, content: m.content });
            }
            if (m.toolCalls) {
              for (const tc of m.toolCalls) {
                arr.push({ id: nextId(), role: 'assistant', content: `[Tool Call] ${tc.name}`, isLog: true });
              }
            }
            // For tool role:
            if (m.role === 'tool') {
               arr.push({ id: nextId(), role: 'system', content: `[Tool Result] ${String((m as any).content).substring(0, 50).replace(/\n/g, ' ')}...`, isLog: true });
            }
            return arr;
          });
          
          setMessages([
            { id: nextId(), role: 'system', content: '📂 Loaded last session successfully.' },
            ...loadedMsgs
          ]);
        } else {
          setMessages(prev => [...prev, { id: systemId, role: 'system', content: '⚠ No previous session found.' }]);
        }
        break;
      }

      // zex: added for security-layer — display security event log
      case 'security': {
        const summary = getSecuritySummary();
        // Color-code each line: BLOCKED=red, WARNING=yellow, LOGGED=gray
        const coloredLines = summary
          .split('\n')
          .map((line) =>
            line.includes('[BLOCKED]')
              ? `\x1b[31m${line}\x1b[0m`   // red
              : line.includes('[WARNING]')
              ? `\x1b[33m${line}\x1b[0m`   // yellow
              : line.includes('[LOGGED]')
              ? `\x1b[90m${line}\x1b[0m`   // gray
              : line,
          )
          .join('\n');
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `🔒 Security Report\n\n${coloredLines}`,
        }]);
        break;
      }

      case 'unknown': {
        setMessages(prev => [...prev, {
          id: systemId, role: 'system',
          content: `Unknown command: ${result.input}\nType /help to see available commands.`,
        }]);
        break;
      }
    }

    return true; // was handled — don't send to LLM
  }, []);

  // ── Main submit handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (input: string) => {
      if (isLoading) return;

      const trimmed = input.trim();
      if (!trimmed) return;

      // Handle slash commands — don't send to LLM
      if (handleSlashCommand(trimmed)) return;

      const userMsgId = nextId();
      setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: trimmed }]);
      setIsLoading(true);

      const assistantMsgId = nextId();
      streamingMsgId.current = assistantMsgId;
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      // In plan mode, prepend the plan instruction
      const messageToSend = planMode
        ? `${PLAN_MODE_PREFIX}\n\n${trimmed}`
        : trimmed;

      let fullResponse = '';

      try {
        const finalHistory = await runTurn(historyRef.current, messageToSend, {
          onDelta(text) {
            fullResponse += text;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: fullResponse } : m,
              ),
            );
          },

          onUsage(inputTokens, outputTokens) {
            setTokenCount(n => n + inputTokens + outputTokens);
          },

          onError(message, _code) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, role: 'system', content: `⚠ ${message}` }
                  : m,
              ),
            );
          },

          onDone(_stopReason) {},

          onToolCall(name, args) {
            // Snapshot for undo BEFORE approval (file may not exist yet)
            if (name === 'write_file' && args.path) {
              const entry = undoStack.snapshot(args.path, name);
              // We'll commit after execution — but we don't have a post-execute hook here yet.
              // Interim: commit immediately (snapshot + placeholder commit)
              undoStack.commit(entry);
            }
            return new Promise(resolve => {
              setPendingTool({ name, args, resolve });
              setMessages(prev => [...prev, {
                 id: nextId(), role: 'assistant', content: `[Tool Call] ${name}`, isLog: true
              }]);
            });
          },

          onToolResult(name, result, isError) {
             const status = isError ? '✗ Error' : '✓ Result';
             setMessages(prev => [...prev, {
               id: nextId(), role: 'system', content: `[${status}] ${name}: ${String(result).substring(0, 80).replace(/\n/g, ' ')}...`, isLog: true
             }]);
          },

          onKeyRotation(message) {
            const noticeId = nextId();
            setMessages(prev => [
              ...prev,
              { id: noticeId, role: 'system', content: `🔑 ${message}` },
            ]);
            // Update key pool summary in status bar
            import('../../agent/keyPool.ts').then(({ KeyPool }) => {
              try {
                const pool = KeyPool.fromEnv();
                setKeyPoolSummary(pool.summaryLine());
              } catch {}
            });
          },

          // zex: added for security-layer — show a TUI notice when task is security-sensitive
          onSecurityFlag(goal: string) {
            const flagId = nextId();
            setMessages(prev => [
              ...prev,
              { id: flagId, role: 'system', content: `🔒 Security-sensitive task detected: "${goal}"\nRun /security after this turn to review any flagged patterns.` },
            ]);
          },
        });

        historyRef.current = finalHistory;
        saveSession(sessionId, finalHistory);
      } finally {
        streamingMsgId.current = null;
        setIsLoading(false);
        setModelLabel(getActiveModelLabel());
      }
    },
    [isLoading, planMode, handleSlashCommand],
  );

  return (
    <Box flexDirection="column" height="100%">
      <Banner />
      <MessageList messages={messages} isStreaming={isLoading || !!pendingTool} showLogs={logsEnabled} />

      {pendingTool ? (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} flexDirection="column">
          {/* Header */}
          <Box marginBottom={1}>
            <Text color="yellow" bold>⚡ Permission Required  </Text>
            <Text color="white" bold>{pendingTool.name}</Text>
          </Box>

          {/* Bash command */}
          {pendingTool.name === 'run_shell_command' ? (
            <Box flexDirection="column" marginBottom={1}>
              {pendingTool.args.description && (
                <Box marginBottom={1}>
                  <Text color="cyan">  {pendingTool.args.description}</Text>
                </Box>
              )}
              <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text color="greenBright">$ </Text>
                <Text color="white">{pendingTool.args.command}</Text>
              </Box>
              {pendingTool.args.working_directory && (
                <Box marginTop={1}>
                  <Text color="gray">  cwd: {pendingTool.args.working_directory}</Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box flexDirection="column" marginBottom={1} marginLeft={2}>
              {Object.entries(pendingTool.args).map(([k, v]) => (
                <Box key={k}>
                  <Text color="gray">{k}: </Text>
                  <Text color="white">{String(v).slice(0, 120)}</Text>
                </Box>
              ))}
            </Box>
          )}

          <Box>
            <Text color="yellow">Allow? </Text>
            <Text color="green" bold>Y</Text>
            <Text color="yellow"> = yes  </Text>
            <Text color="red" bold>n</Text>
            <Text color="yellow"> = deny</Text>
            {undoStack.depth > 0 && (
              <Text color={theme_dim}>  ·  /undo available ({undoStack.depth} operations)</Text>
            )}
          </Box>
        </Box>
      ) : (
        <InputBox
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Message zex… (or /help for commands)"
        />
      )}

      <StatusBar
        model={modelLabel}
        tokenCount={tokenCount}
        isLoading={isLoading}
        keyPoolSummary={keyPoolSummary}
        planMode={planMode}
      />
    </Box>
  );
}

// tiny inline const to avoid import just for one color
const theme_dim = '#52525B';
