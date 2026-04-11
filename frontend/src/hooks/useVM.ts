import { useRef, useState, useEffect, useCallback } from 'react';
import type { ExecutionEvent, NarrationToken, NarrationEvent, VMMessage, Program } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseVMReturn {
  execState: ExecutionEvent | null;
  narrationTokens: NarrationToken[];
  connectionStatus: ConnectionStatus;
  sendStep: () => void;
  sendRun: () => void;
  sendReset: () => void;
}

export function useVM(program: Program): UseVMReturn {
  const [execState, setExecState] = useState<ExecutionEvent | null>(null);
  const [narrationTokens, setNarrationTokens] = useState<NarrationToken[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const programRef = useRef<Program>(program);
  programRef.current = program;

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('connecting');
    setNarrationTokens([]);

    const ws = new WebSocket('ws://localhost:8000/ws/run');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      ws.send(JSON.stringify({ type: 'init', program: programRef.current }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VMMessage;
        if (msg.type === 'exec') {
          setExecState(msg.data as ExecutionEvent);
        } else if (msg.type === 'narration') {
          const narEvent = msg.data as NarrationEvent;
          setNarrationTokens((prev) => [
            ...prev,
            { id: crypto.randomUUID(), text: narEvent.token, tag: narEvent.tag },
          ]);
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setConnectionStatus('disconnected');
    ws.onerror = () => setConnectionStatus('error');
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendStep  = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'step' }));
  }, []);

  const sendRun   = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'run' }));
  }, []);

  const sendReset = useCallback(() => {
    setExecState(null);
    setNarrationTokens([]);
    connect();
  }, [connect]);

  return { execState, narrationTokens, connectionStatus, sendStep, sendRun, sendReset };
}
