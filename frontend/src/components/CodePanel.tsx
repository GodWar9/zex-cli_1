import { type ReactElement } from 'react';
import _Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';

// Fix for Vite CJS/ESM interop where default is nested
const Editor = (_Editor as any).default || _Editor;

interface CodePanelProps {
  code: string;
  onChange: (c: string) => void;
  onRun: () => void;
  status: string;
  currentLine?: number | null;
}

export function CodePanel({ code, onChange, onRun, status, currentLine }: CodePanelProps): ReactElement {
  const isConnected = status === 'connected';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Input
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-dim)' }}>Plain English / Any Language</span>
        </div>
        
        <button 
          onClick={onRun}
          disabled={!isConnected}
          style={{
            backgroundColor: isConnected ? 'var(--intent-blue)' : 'var(--border-dim)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            fontWeight: 'bold',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '12px',
            transition: 'background-color 0.2s'
          }}>
          ▶ Run Simulation
        </button>
      </div>
      
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#2d2d2d',
        borderRadius: '8px',
        border: '1px solid var(--border-dim)',
        overflow: 'auto',
      }}>
        {currentLine && currentLine > 0 && (
            <div style={{
                position: 'absolute',
                top: `${(currentLine - 1) * 21 + 16}px`, // 14px * 1.5 lineHeight = 21px + 16px padding
                left: 0,
                width: '100%',
                height: '21px',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                borderLeft: '4px solid rgb(234, 179, 8)',
                pointerEvents: 'none',
                zIndex: 1
            }} />
        )}
        <div style={{ zIndex: 2, position: 'relative' }}>
          <Editor
            value={code}
            onValueChange={onChange}
            highlight={(code: string) => Prism.highlight(code, Prism.languages.python, 'python')}
            padding={16}
            style={{
              fontFamily: '"Fira code", "Fira Mono", monospace',
              fontSize: 14,
              minHeight: '100%',
              backgroundColor: 'transparent',
              lineHeight: '1.5',
              border: 'none',
              outline: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
