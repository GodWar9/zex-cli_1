import { useRef, useState, useEffect, useCallback } from 'react';
import type { SchedulerEvent, NarrationToken, VMMessage } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSchedulerReturn {
  currentEvent: SchedulerEvent | null;
  narrationTokens: NarrationToken[];
  terminalOutput: string[];
  connectionStatus: ConnectionStatus;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  sendStart: (mode: 'heuristic' | 'ppo') => void;
  sendPause: () => void;
  sendResume: () => void;
  sendReset: () => void;
}

export function useScheduler(): UseSchedulerReturn {
  const [currentEvent, setCurrentEvent] = useState<SchedulerEvent | null>(null);
  const [narrationTokens, setNarrationTokens] = useState<NarrationToken[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(['[SYSTEM] Cortex Scheduler connected.']);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // Speed control via mapped TPS
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(2); // 2 TPS default

  const wsRef = useRef<WebSocket | null>(null);

  // Buffer references
  const eventQueueRef = useRef<SchedulerEvent[]>([]);
  const narrationQueueRef = useRef<NarrationToken[]>([]);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(playbackSpeed);

  useEffect(() => {
    speedRef.current = playbackSpeed;
    // Tell server to adjust TPS dynamically if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'speed', tps: playbackSpeed }));
    }
  }, [playbackSpeed]);

  const processQueues = useCallback(() => {
    if (isPlayingRef.current) return;
    if (eventQueueRef.current.length === 0 && narrationQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    const delayMs = 1000 / speedRef.current;
    
    setTimeout(() => {
      if (eventQueueRef.current.length > 0) {
        const ev = eventQueueRef.current.shift()!;
        setCurrentEvent(ev);
        
        // Log agent actions to terminal securely
        const act = ev.agent_action;
        let actionStr = `[TICK ${ev.tick}] `;
        if (act.scheduled_pid !== null) {
          actionStr += `CPU ➔ PID ${act.scheduled_pid} | `;
        } else {
          actionStr += `CPU ➔ IDLE | `;
        }
        
        const allocs = Object.entries(act.bandwidth_alloc);
        if (allocs.length > 0) {
          actionStr += `NET ➔ ` + allocs.map(([pid, bw]) => `PID ${pid}:${bw}u`).join(', ');
        } else {
          actionStr += `NET ➔ IDLE`;
        }
        setTerminalOutput(prev => [...prev, actionStr]);
      }
      
      const newTokens = narrationQueueRef.current.splice(0, 3);
      if (newTokens.length > 0) {
        setNarrationTokens(prev => [...prev, ...newTokens]);
      }
      
      isPlayingRef.current = false;
      processQueues();
    }, delayMs);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('connecting');

    // Make sure server is listening on 8001 for scheduler
    const ws = new WebSocket('ws://localhost:8001/ws/scheduler');
    wsRef.current = ws;

    ws.onopen = () => setConnectionStatus('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VMMessage;
        
        if (msg.type === 'tick') {
          eventQueueRef.current.push(msg.data as SchedulerEvent);
          processQueues();
        } 
        else if (msg.type === 'narration') {
          const nar = msg.data as any; // Actually a NarrationEvent in py, mapped similarly
          narrationQueueRef.current.push({ 
            id: crypto.randomUUID(), 
            text: nar.text, 
            tag: nar.narration_type === 'step' || nar.narration_type === 'intent' || nar.narration_type === 'warning' || nar.narration_type === 'error' ? nar.narration_type : 'plain' 
          });
          processQueues();
        } 
        else if (msg.type === 'error') {
          setTerminalOutput(prev => [...prev, `[ERROR] ${JSON.stringify(msg.data)}`]);
          processQueues();
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => setConnectionStatus('disconnected');
    ws.onerror = () => setConnectionStatus('error');
  }, [processQueues]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const sendStart = useCallback((mode: 'heuristic' | 'ppo') => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start', mode, tps: playbackSpeed }));
    }
  }, [playbackSpeed]);

  const sendPause = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'pause' }));
    }
  }, []);

  const sendResume = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resume' }));
    }
  }, []);

  const sendReset = useCallback(() => {
    setCurrentEvent(null);
    setNarrationTokens([]);
    setTerminalOutput(['[SYSTEM] Scheduler reset.']);
    eventQueueRef.current = [];
    narrationQueueRef.current = [];
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset' }));
    }
  }, []);

  return { 
    currentEvent, 
    narrationTokens, 
    terminalOutput, 
    connectionStatus, 
    playbackSpeed, 
    setPlaybackSpeed, 
    sendStart, 
    sendPause, 
    sendResume,
    sendReset 
  };
}
