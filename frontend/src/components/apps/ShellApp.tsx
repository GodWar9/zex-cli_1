import { useState, useRef, useEffect } from 'react';
import { useShell } from '../../hooks/useShell';

export function ShellApp() {
  const { messages, sendCommand, isLoading } = useShell();
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setCommandHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    sendCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const newIndex = historyIndex + 1;
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0c0c0c',
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
      }}>
        <span style={{ letterSpacing: '0.1em' }}>CORTEX SHELL</span>
        <span style={{ color: '#30d158' }}>● AI-POWERED</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Welcome message */}
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, lineHeight: 1.6 }}>
          Welcome to CortexShell — the AI command interface.<br />
          Type natural language commands. Examples:<br />
          <span style={{ color: '#30d158' }}>  "why is the system slow"</span><br />
          <span style={{ color: '#30d158' }}>  "show system status"</span><br />
          <span style={{ color: '#30d158' }}>  "run a fibonacci program"</span><br />
        </div>

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === 'user' ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#30d158', fontSize: 13, flexShrink: 0 }}>❯</span>
                <span style={{ color: '#e0e0e0', fontSize: 13 }}>{msg.text}</span>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                padding: '10px 12px',
                borderLeft: '3px solid #0a84ff',
                marginLeft: 16,
              }}>
                {msg.analysis && (
                  <div style={{ fontSize: 11, color: '#0a84ff', marginBottom: 6, fontWeight: 600, letterSpacing: '0.05em' }}>
                    ANALYSIS
                  </div>
                )}
                {msg.analysis && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10, lineHeight: 1.5 }}>
                    {msg.analysis}
                  </div>
                )}
                {msg.action && msg.action !== 'none' && (
                  <div style={{
                    fontSize: 11, color: '#ff9f0a', background: 'rgba(255,159,10,0.08)',
                    padding: '4px 8px', borderRadius: 4, marginBottom: 8, display: 'inline-block',
                  }}>
                    ⚡ {msg.action}
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.6 }}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16 }}>
            <div className="shell-loading-dots" style={{ display: 'flex', gap: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0a84ff', animation: 'shellPulse 1.2s ease-in-out infinite' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0a84ff', animation: 'shellPulse 1.2s 0.2s ease-in-out infinite' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#0a84ff', animation: 'shellPulse 1.2s 0.4s ease-in-out infinite' }} />
            </div>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>CortexShell is thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <span style={{ color: '#30d158', fontSize: 14, flexShrink: 0 }}>❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Type a command..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e0e0e0',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
          autoFocus
        />
      </form>
    </div>
  );
}
