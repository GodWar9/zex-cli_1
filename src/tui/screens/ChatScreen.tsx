import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Banner from '../components/Banner.tsx';
import MessageList, { type Message } from '../components/MessageList.tsx';
import InputBox from '../components/InputBox.tsx';
import StatusBar from '../components/StatusBar.tsx';
import { runTurn, type ConversationMessage } from '../../agent/runner.ts';
import { getActiveModelLabel, loadConfig } from '../../config/index.ts';
import { parseSlashCommand, buildHelpMessage } from '../slashCommands.ts';
import { undoStack } from '../../session/undoStack.ts';
import { saveSession, loadLastSession, generateSessionId } from '../../session/store.ts';
import { getSecuritySummary, logSecurityEvent, securityLog } from '../../security/eventLog.ts';
import { auditProject } from '../../security/projectAudit.ts';
import { buildContextReport } from '../../context/status.ts';
import { metrics } from '../../session/metrics.ts';
import { remember, recall, clusterMemories } from '../../session/memory.ts';
import { budgetTracker } from '../../session/budget.ts';
import { exportSessionMarkdown } from '../../session/export.ts';
import { dualCache } from '../../cache/index.ts';
import { startFileWatcher } from '../../utils/fileWatcher.ts';
import { gc } from '../../agent/gcState.ts';
import { parseIntent } from '../../agent/intent.ts';
import { executeDAG } from '../../agent/orchestrator.ts';
import { collaborativeDebug } from '../../agent/collabDebug.ts';
import type { RunnerCallbacks } from '../../agent/runner.ts';
import { auditDependencies, formatDepAudit } from '../../security/depAudit.ts';
import { ensureAuthenticated, authenticate, formatAuthStatus } from '../../enterprise/auth.ts';
import { formatOrgSummary } from '../../enterprise/orgConfig.ts';
import { formatAuditSummary, setAuditSession } from '../../enterprise/auditLog.ts';
import { exportFineTuneDataset } from '../../enterprise/fineTuneExport.ts';

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
  const [cacheHitRate, setCacheHitRate] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [budgetWarning, setBudgetWarning] = useState(false);
  const [sessionId] = useState(() => generateSessionId());

  const [pendingTool, setPendingTool] = useState<{
    name: string;
    args: any;
    resolve: (b: boolean) => void;
  } | null>(null);

  const streamingMsgId = useRef<string | null>(null);
  const historyRef     = useRef<ConversationMessage[]>([]);
  const auditDone      = useRef(false); // zex: added for security-layer

  // ── Startup: security audit, file watcher, GC background eviction ─────────
  useEffect(() => {
    if (auditDone.current) return;
    auditDone.current = true;

    async function startup() {
      setAuditSession(sessionId);
      budgetTracker.syncFromOrg();

      const auth = await ensureAuthenticated();
      if (!auth.ok) {
        setMessages([{ id: nextId(), role: 'system', content: `🔐 ${auth.message}` }]);
      } else {
        setMessages([{ id: nextId(), role: 'system', content: `✓ ${formatAuthStatus()}` }]);
      }

      const root = process.cwd();
      const context = await auditProject(root);
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

      const depResult = await auditDependencies(root);
      if (depResult.findings.length > 0) {
        setMessages(prev => [...prev, {
          id: nextId(), role: 'system',
          content: `📦 Dependency audit:\n${formatDepAudit(depResult)}`,
        }]);
      }

      const clustered = clusterMemories();
      if (clustered > 0) {
        setMessages(prev => [...prev, {
          id: nextId(), role: 'system', content: `🧠 Merged ${clustered} duplicate memory clusters on startup.`,
        }]);
      }
    }

    startup();
    startFileWatcher(process.cwd());
    gc.startBackgroundEviction();
  }, [sessionId]);

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

      case 'redo': {
        const result = undoStack.redo();
        setMessages(prev => [...prev, {
          id: systemId,
          role: 'system',
          content: result ? `↪ Redone: ${result}` : '⚠ Nothing to redo.',
        }]);
        break;
      }

      case 'context': {
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: buildContextReport(historyRef.current),
        }]);
        break;
      }

      case 'stats': {
        const statsText = result.budget
          ? `${metrics.formatStats()}\n\n${budgetTracker.formatReport()}`
          : metrics.formatStats();
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: statsText,
        }]);
        setCacheHitRate(dualCache.getHitRate());
        break;
      }

      case 'cache-clear': {
        dualCache.clear();
        setCacheHitRate(0);
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: '🗑 Response cache cleared.',
        }]);
        break;
      }

      case 'remember': {
        const entry = remember(result.text);
        const clustered = clusterMemories();
        const clusterNote = clustered > 0 ? ` (merged ${clustered} duplicate clusters)` : '';
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `💾 Remembered: "${entry.text}"${clusterNote}`,
        }]);
        break;
      }

      case 'recall': {
        const hits = recall(result.query || 'recent');
        const text = hits.length === 0
          ? 'No matching memories found.'
          : hits.map((h) => `  • ${h.text}`).join('\n');
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `🧠 Memories:\n${text}`,
        }]);
        break;
      }

      case 'export': {
        const path = exportSessionMarkdown(historyRef.current, sessionId);
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `📄 Exported to ${path}`,
        }]);
        break;
      }

      case 'export-finetune': {
        const path = exportFineTuneDataset(historyRef.current, sessionId);
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `🎯 Fine-tune dataset exported to ${path}`,
        }]);
        break;
      }

      case 'deps': {
        auditDependencies(process.cwd()).then((r) => {
          setMessages(prev => [...prev, {
            id: systemId, role: 'system', content: formatDepAudit(r),
          }]);
        });
        break;
      }

      case 'cluster': {
        const n = clusterMemories();
        setMessages(prev => [...prev, {
          id: systemId, role: 'system',
          content: n > 0 ? `🧠 Merged ${n} duplicate memory clusters.` : 'No duplicate memories to merge.',
        }]);
        break;
      }

      case 'debug':
        setDebugMode(prev => {
          const next = !prev;
          setMessages(m => [...m, {
            id: systemId, role: 'system',
            content: next
              ? '🔍 Collaborative debug mode ON — agents vote on fixes.'
              : '🔍 Collaborative debug mode OFF.',
          }]);
          return next;
        });
        break;

      case 'org': {
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: `${formatOrgSummary()}\n\n${formatAuthStatus()}`,
        }]);
        break;
      }

      case 'audit': {
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: formatAuditSummary(30),
        }]);
        break;
      }

      case 'login': {
        const parts = result.args.split(/\s+/);
        const [user, pass] = parts;
        authenticate({ username: user, password: pass, token: result.args }).then((s) => {
          setMessages(prev => [...prev, {
            id: systemId, role: 'system',
            content: s ? `✓ Logged in as ${s.email}` : '✗ Authentication failed.',
          }]);
        });
        break;
      }

      case 'reset':
        historyRef.current = [];
        setMessages([]);
        setTokenCount(0);
        setMessages([{ id: nextId(), role: 'system', content: '🔄 Session reset.' }]);
        break;

      case 'config': {
        const cfg = loadConfig();
        const lines = [
          'Current config:',
          `  provider: ${cfg.provider.provider}`,
          `  model:    ${cfg.provider.model}`,
          `  maxTokens: ${cfg.provider.maxTokens}`,
          `  temperature: ${cfg.provider.temperature}`,
          '',
          'Edit ~/.zex/config.json to change settings.',
        ];
        setMessages(prev => [...prev, {
          id: systemId, role: 'system', content: lines.join('\n'),
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

      const intent = parseIntent(trimmed);
      const useMultiAgent = loadConfig().multiAgent === true;

      const runCallbacks: RunnerCallbacks = {
          onDelta(text: string) {
            fullResponse += text;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: fullResponse } : m,
              ),
            );
          },

          onUsage(inputTokens: number, outputTokens: number) {
            setTokenCount(n => n + inputTokens + outputTokens);
          },

          onError(message: string, _code?: string) {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMsgId
                  ? { ...m, role: 'system', content: `⚠ ${message}` }
                  : m,
              ),
            );
          },

          onDone(_stopReason: string) {},

          onToolCall(name: string, args: Record<string, unknown>): Promise<boolean> {
            // Snapshot for undo BEFORE approval (file may not exist yet)
            if (name === 'write_file' && args.path) {
              const entry = undoStack.snapshot(args.path, name);
              // We'll commit after execution — but we don't have a post-execute hook here yet.
              // Interim: commit immediately (snapshot + placeholder commit)
              undoStack.commit(entry);
            }
            return new Promise<boolean>(resolve => {
              setPendingTool({ name, args, resolve });
              setMessages(prev => [...prev, {
                 id: nextId(), role: 'assistant', content: `[Tool Call] ${name}`, isLog: true
              }]);
            });
          },

          onToolResult(name: string, result: string, isError?: boolean) {
             const status = isError ? '✗ Error' : '✓ Result';
             setMessages(prev => [...prev, {
               id: nextId(), role: 'system', content: `[${status}] ${name}: ${String(result).substring(0, 80).replace(/\n/g, ' ')}...`, isLog: true
             }]);
          },

          onKeyRotation(message: string) {
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
      };

      try {
        let finalHistory: ConversationMessage[];

        if (debugMode || intent.action === 'debug') {
          const collab = await collaborativeDebug(intent, messageToSend, historyRef.current, {
            ...runCallbacks,
            onAgentStart(agent, task) {
              setMessages(prev => [...prev, {
                id: nextId(), role: 'system', content: `🤖 ${agent}: ${task.slice(0, 80)}…`, isLog: true,
              }]);
            },
            onVoteResult(summary) {
              setMessages(prev => [...prev, {
                id: nextId(), role: 'system', content: summary,
              }]);
            },
          });
          finalHistory = collab.history;
        } else if (useMultiAgent && ['fix', 'refactor', 'plan', 'debug'].includes(intent.action)) {
          const dagResult = await executeDAG(intent, messageToSend, historyRef.current, {
            ...runCallbacks,
            onAgentStart(agent, task) {
              setMessages(prev => [...prev, {
                id: nextId(), role: 'system', content: `🤖 ${agent}: ${task.slice(0, 80)}…`, isLog: true,
              }]);
            },
          });
          finalHistory = dagResult.history;
        } else {
          finalHistory = await runTurn(historyRef.current, messageToSend, runCallbacks);
        }

        historyRef.current = finalHistory;
        saveSession(sessionId, finalHistory);
        setCacheHitRate(dualCache.getHitRate());
        setBudgetWarning(budgetTracker.warning || budgetTracker.isOverCap());
      } finally {
        streamingMsgId.current = null;
        setIsLoading(false);
        setModelLabel(getActiveModelLabel());
      }
    },
    [isLoading, planMode, debugMode, handleSlashCommand, sessionId],
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
        debugMode={debugMode}
        cacheHitRate={cacheHitRate}
        budgetWarning={budgetWarning}
        securityOk={securityLog.filter((e) => e.action === 'blocked').length === 0}
      />
    </Box>
  );
}

// tiny inline const to avoid import just for one color
const theme_dim = '#52525B';
