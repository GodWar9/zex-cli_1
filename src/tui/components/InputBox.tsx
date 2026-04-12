import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { theme } from '../theme.ts';
import { parseFileRefs, formatRefsSummary } from '../../utils/fileRefs.ts';

type Props = {
  onSubmit: (value: string) => void;
  isLoading?: boolean;
  placeholder?: string;
};

const MAX_HISTORY = 200;

// Show the right modifier key label per OS.
// The actual key detection (key.meta) works identically on all platforms.
const NEWLINE_KEY_LABEL =
  process.platform === 'darwin' ? '⌥↵ Option+Enter'
  : process.platform === 'win32' ? 'Alt+Enter'
  : 'Alt+Enter';

// ─── Cursor helpers ───────────────────────────────────────────────────────────

interface CursorPos {
  line: number;
  col: number;
}

function clampCol(lines: string[], line: number, col: number): number {
  return Math.min(col, lines[line]?.length ?? 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InputBox({
  onSubmit,
  isLoading = false,
  placeholder = 'Message zex…',
}: Props) {
  // Multi-line content stored as array of lines
  const [lines, setLines]     = useState<string[]>(['']);
  const [cursor, setCursor]   = useState<CursorPos>({ line: 0, col: 0 });

  // @file reference state — parsed live as the user types
  const [refSummary, setRefSummary] = useState<string>('');
  const [refCount, setRefCount]     = useState<number>(0);

  // History
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const draftRef      = useRef<string[]>(['']);

  // Terminal width for box sizing
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;

  // ── Submit ────────────────────────────────────────────────────────────────
  const doSubmit = useCallback((currentLines: string[]) => {
    const text = currentLines.join('\n').trim();
    if (!text) return;

    // Parse @file refs and build the augmented prompt
    const parsed = parseFileRefs(text);
    const finalText = parsed.augmentedPrompt; // includes file context blocks

    const history = historyRef.current;
    if (history[history.length - 1] !== text) {
      history.push(text); // save the original (not augmented) to history
      if (history.length > MAX_HISTORY) history.shift();
    }

    historyIdxRef.current = -1;
    draftRef.current = [''];
    setRefSummary('');
    setRefCount(0);
    onSubmit(finalText);
    setLines(['']);
    setCursor({ line: 0, col: 0 });
  }, [onSubmit]);

  // ── Live @ref parsing — re-parse whenever lines change ───────────────────
  useEffect(() => {
    const text = lines.join('\n');
    if (!text.includes('@')) {
      setRefSummary('');
      setRefCount(0);
      return;
    }
    const parsed = parseFileRefs(text);
    setRefSummary(formatRefsSummary(parsed.refs));
    setRefCount(parsed.refs.length);
  }, [lines]);

  // ── Input handler ─────────────────────────────────────────────────────────
  useInput(
    (input, key) => {
      // ── Enter ──────────────────────────────────────────────────────────────
      if (key.return) {
        // key.meta = Option/Alt key held (⌥↵) — reliably distinguishable from plain Enter
        // key.shift = Shift key (works in kitty / WezTerm; no-op on most standard terminals)
        if (key.shift || key.meta) {
          // Option+Enter or Shift+Enter → insert newline at cursor
          setLines(prev => {
            const next = [...prev];
            const ln = next[cursor.line] ?? '';
            const before = ln.slice(0, cursor.col);
            const after  = ln.slice(cursor.col);
            next.splice(cursor.line, 1, before, after);
            return next;
          });
          setCursor(prev => ({ line: prev.line + 1, col: 0 }));
          // Exit history mode
          historyIdxRef.current = -1;
          draftRef.current = [''];
        } else {
          // Plain Enter → submit
          doSubmit(lines);
        }
        return;
      }

      // ── Backspace ──────────────────────────────────────────────────────────
      if (key.backspace || key.delete) {
        // Exit history mode
        if (historyIdxRef.current !== -1) {
          historyIdxRef.current = -1;
          draftRef.current = [''];
        }

        setLines(prev => {
          const next = [...prev];
          if (cursor.col > 0) {
            const ln = next[cursor.line] ?? '';
            next[cursor.line] = ln.slice(0, cursor.col - 1) + ln.slice(cursor.col);
            setCursor(c => ({ ...c, col: c.col - 1 }));
          } else if (cursor.line > 0) {
            // Merge current line onto previous
            const prevLen = next[cursor.line - 1]?.length ?? 0;
            next[cursor.line - 1] = (next[cursor.line - 1] ?? '') + (next[cursor.line] ?? '');
            next.splice(cursor.line, 1);
            setCursor({ line: cursor.line - 1, col: prevLen });
          }
          return next;
        });
        return;
      }

      // ── Left arrow ────────────────────────────────────────────────────────
      if (key.leftArrow) {
        setCursor(prev => {
          if (prev.col > 0) return { ...prev, col: prev.col - 1 };
          if (prev.line > 0) {
            const newLine = prev.line - 1;
            return { line: newLine, col: lines[newLine]?.length ?? 0 };
          }
          return prev;
        });
        return;
      }

      // ── Right arrow ───────────────────────────────────────────────────────
      if (key.rightArrow) {
        setCursor(prev => {
          const lineLen = lines[prev.line]?.length ?? 0;
          if (prev.col < lineLen) return { ...prev, col: prev.col + 1 };
          if (prev.line < lines.length - 1) return { line: prev.line + 1, col: 0 };
          return prev;
        });
        return;
      }

      // ── Up arrow ──────────────────────────────────────────────────────────
      if (key.upArrow) {
        if (cursor.line > 0) {
          // Move cursor up within multi-line draft
          setCursor(prev => ({
            line: prev.line - 1,
            col: clampCol(lines, prev.line - 1, prev.col),
          }));
          return;
        }
        // At first line → history navigation
        const history = historyRef.current;
        if (history.length === 0) return;
        if (historyIdxRef.current === -1) {
          draftRef.current = [...lines];
          historyIdxRef.current = history.length - 1;
        } else if (historyIdxRef.current > 0) {
          historyIdxRef.current -= 1;
        }
        const entry = (history[historyIdxRef.current] ?? '').split('\n');
        setLines(entry);
        setCursor({ line: 0, col: entry[0]?.length ?? 0 });
        return;
      }

      // ── Down arrow ────────────────────────────────────────────────────────
      if (key.downArrow) {
        if (cursor.line < lines.length - 1) {
          // Move cursor down within multi-line draft
          setCursor(prev => ({
            line: prev.line + 1,
            col: clampCol(lines, prev.line + 1, prev.col),
          }));
          return;
        }
        // At last line → history navigation
        if (historyIdxRef.current === -1) return;
        if (historyIdxRef.current < historyRef.current.length - 1) {
          historyIdxRef.current += 1;
          const entry = (historyRef.current[historyIdxRef.current] ?? '').split('\n');
          setLines(entry);
          setCursor({ line: 0, col: entry[0]?.length ?? 0 });
        } else {
          // Restore draft
          historyIdxRef.current = -1;
          const draft = draftRef.current;
          setLines(draft);
          setCursor({ line: draft.length - 1, col: draft[draft.length - 1]?.length ?? 0 });
        }
        return;
      }

      // ── Regular character ─────────────────────────────────────────────────
      if (input && !key.ctrl && !key.meta && input.length > 0) {
        // Exit history mode — editing a copy
        if (historyIdxRef.current !== -1) {
          historyIdxRef.current = -1;
          draftRef.current = [''];
        }

        setLines(prev => {
          const next = [...prev];
          const ln = next[cursor.line] ?? '';
          next[cursor.line] = ln.slice(0, cursor.col) + input + ln.slice(cursor.col);
          return next;
        });
        setCursor(prev => ({ ...prev, col: prev.col + input.length }));
      }
    },
    { isActive: !isLoading },
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const isEmpty = lines.length === 1 && lines[0] === '';
  const isMultiLine = lines.length > 1;

  return (
    <Box
      borderStyle="round"
      borderColor={isLoading ? theme.colors.dim : theme.colors.primary}
      paddingX={1}
      marginX={1}
      marginBottom={0}
      flexDirection="column"
    >
      {isLoading ? (
        <Box>
          <Text color={theme.colors.dim} bold>{theme.symbols.prompt} </Text>
          <Text color={theme.colors.accent}> thinking...</Text>
        </Box>
      ) : (
        <>
          {isEmpty ? (
            /* Placeholder when empty */
            <Box>
              <Text color={theme.colors.primary} bold>{theme.symbols.prompt} </Text>
              <Text color={theme.colors.dim}>{placeholder}</Text>
            </Box>
          ) : (
            /* Render each line, injecting the block cursor */
            lines.map((ln, i) => {
              const isActiveLine = i === cursor.line;
              const col = isActiveLine ? cursor.col : -1;

              const before  = isActiveLine ? ln.slice(0, col) : ln;
              const atCursor = isActiveLine ? (ln[col] ?? ' ') : '';
              const after   = isActiveLine ? ln.slice(col + 1) : '';

              return (
                <Box key={i}>
                  {i === 0 && (
                    <Text color={theme.colors.primary} bold>{theme.symbols.prompt} </Text>
                  )}
                  {i > 0 && (
                    /* Indent continuation lines to align with first line's text */
                    <Text color={theme.colors.dim}>{'  '}</Text>
                  )}

                  {isActiveLine ? (
                    <>
                      <Text>{before}</Text>
                      <Text inverse>{atCursor}</Text>
                      <Text>{after}</Text>
                    </>
                  ) : (
                    <Text>{ln}</Text>
                  )}
                </Box>
              );
            })
          )}

          {/* @file reference pill bar — shown when refs are detected */}
          {refCount > 0 && (
            <Box marginTop={0} marginLeft={2}>
              <Text color="green">{refSummary}</Text>
              <Text color={theme.colors.dim}>  will be sent as context</Text>
            </Box>
          )}

          {isMultiLine && (
            <Box marginTop={0}>
              <Text color={theme.colors.dim} dimColor>
                {'  '}Enter ↵ to send  ·  {NEWLINE_KEY_LABEL} for new line
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
