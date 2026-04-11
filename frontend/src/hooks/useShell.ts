import { useState, useCallback } from 'react';

export interface ShellMessage {
  role: 'user' | 'assistant';
  text: string;
  analysis?: string;
  action?: string;
}

interface UseShellReturn {
  messages: ShellMessage[];
  sendCommand: (command: string) => void;
  isLoading: boolean;
}

export function useShell(): UseShellReturn {
  const [messages, setMessages] = useState<ShellMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendCommand = useCallback(async (command: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', text: command }]);
    setIsLoading(true);

    try {
      const resp = await fetch('http://localhost:8000/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response || 'No response.',
        analysis: data.analysis,
        action: data.action,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Connection error: ${err.message}. Make sure the backend is running on port 8000.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { messages, sendCommand, isLoading };
}
