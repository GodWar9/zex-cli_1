import { useRef, useState, useEffect, useCallback } from 'react';
import type { SimulatedStep, NarrationToken, VMMessage } from '../types';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseVMReturn {
  steps: SimulatedStep[];
  narrationTokens: NarrationToken[];
  terminalOutput: string[];
  connectionStatus: ConnectionStatus;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  sendSimulate: (code: string) => void;
  sendReset: () => void;
}

export function useVM(): UseVMReturn {
  const [steps, setSteps] = useState<SimulatedStep[]>([]);
  const [narrationTokens, setNarrationTokens] = useState<NarrationToken[]>([]);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(['[SYSTEM] Cortex Universal Simulator ready.', '[SYSTEM] Awaiting simulated code...']);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  
  // Speed control in milliseconds delay per step
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(800); 

  const wsRef = useRef<WebSocket | null>(null);
  
  // Playback buffer logic
  const stepQueueRef = useRef<SimulatedStep[]>([]);
  const eventQueueRef = useRef<(NarrationToken | { type: 'terminal', text: string })[]>([]);
  const isPlayingRef = useRef(false);
  const speedRef = useRef(playbackSpeed);

  useEffect(() => {
    speedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const processQueues = useCallback(() => {
    if (isPlayingRef.current) return;
    
    // Check if anything is waiting
    if (stepQueueRef.current.length === 0 && eventQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    
    setTimeout(() => {
      // Process 1 step if available
      if (stepQueueRef.current.length > 0) {
        const step = stepQueueRef.current.shift()!;
        setSteps(prev => [...prev, step]);
      }
      
      // Process up to 2 narration/terminal events simultaneously to keep up
      const eventsToProcess = eventQueueRef.current.splice(0, 2);
      let newTokens: NarrationToken[] = [];
      let newTerminal: string[] = [];
      
      eventsToProcess.forEach(ev => {
        if ('type' in ev && ev.type === 'terminal') {
          newTerminal.push(ev.text);
        } else {
          newTokens.push(ev as NarrationToken);
        }
      });
      
      if (newTokens.length > 0) setNarrationTokens(prev => [...prev, ...newTokens]);
      if (newTerminal.length > 0) setTerminalOutput(prev => [...prev, ...newTerminal]);
      
      isPlayingRef.current = false;
      // Loop
      processQueues();
    }, speedRef.current);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('connecting');

    const ws = new WebSocket('ws://localhost:8000/ws/simulator');
    wsRef.current = ws;

    ws.onopen = () => setConnectionStatus('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VMMessage;
        
        if (msg.type === 'info') {
            eventQueueRef.current.push({ id: crypto.randomUUID(), text: String(msg.data), tag: 'plain' });
            processQueues();
        } 
        else if (msg.type === 'sim_step') {
          const step = msg.data as SimulatedStep;
          stepQueueRef.current.push(step);
          
          if (step.output) {
             eventQueueRef.current.push({ type: 'terminal', text: String(step.output) });
          }

          if (step.intent) {
             eventQueueRef.current.push({ id: crypto.randomUUID(), text: String(step.intent), tag: 'intent' });
          }
          if (step.warning) {
             eventQueueRef.current.push({ id: crypto.randomUUID(), text: String(step.warning), tag: 'warning' });
          }
          
          processQueues();
        } 
        else if (msg.type === 'error') {
          eventQueueRef.current.push({ id: crypto.randomUUID(), text: String(msg.data), tag: 'error' });
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

  const sendSimulate = useCallback((code: string) => {
    // Clear everything
    setSteps([]);
    setNarrationTokens([]);
    setTerminalOutput(['[SYSTEM] Cortex Universal Simulator ready.', '[SYSTEM] Attempting execution simulator...']);
    stepQueueRef.current = [];
    eventQueueRef.current = [];
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'simulate', code }));
    }
  }, []);

  const sendReset = useCallback(() => {
    setSteps([]);
    setNarrationTokens([]);
    setTerminalOutput(['[SYSTEM] Cortex Universal Simulator ready.', '[SYSTEM] State cleared.']);
    stepQueueRef.current = [];
    eventQueueRef.current = [];
    // don't physically reconnect, just clear local state for UX speed
  }, []);

  return { steps, narrationTokens, terminalOutput, connectionStatus, playbackSpeed, setPlaybackSpeed, sendSimulate, sendReset };
}
