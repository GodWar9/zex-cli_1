import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type GameState = 'IDLE' | 'LOADING' | 'BRIEFING' | 'PLAYING' | 'DEBRIEF';

export interface ActionLogEntry {
  time_elapsed: number;
  action: string;
  resource: string;
  vuln_fixed?: string;
  vuln_missed?: string;
}

export interface Vulnerability {
  id: string;
  type: string;
  resource: string;
  severity: string;
  description: string;
  fix_action: string;
  points: number;
}

export interface Scenario {
  scenario_id: string;
  type: string;
  company: string;
  stakes: string;
  time_limit_seconds: number;
  briefing: string;
  environment: any;
  vulnerabilities: Vulnerability[];
  attacker_sequence: any[];
}

interface GameContextType {
  gameState: GameState;
  scenario: Scenario | null;
  timeRemaining: number;
  timeElapsed: number;
  actionLog: ActionLogEntry[];
  unfixedVulns: Set<string>;
  score: number;
  debriefText: string;
  generateScenario: () => Promise<void>;
  startGame: () => void;
  endGame: () => void;
  logAction: (action: string, resource: string, vuln_fixed?: string) => void;
  resetGame: () => void;
  fixVuln: (vulnId: string) => void;
  markAttacked: (vulnId: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [actionLog, setActionLog] = useState<ActionLogEntry[]>([]);
  const [unfixedVulns, setUnfixedVulns] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [debriefText, setDebriefText] = useState('');

  // Main countdown timer
  useEffect(() => {
    let timer: any;
    if (gameState === 'PLAYING' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else if (gameState === 'PLAYING' && timeRemaining === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [gameState, timeRemaining]);

  // Check for early completion
  useEffect(() => {
    if (gameState === 'PLAYING' && unfixedVulns.size === 0 && scenario) {
      endGame();
    }
  }, [unfixedVulns, gameState, scenario]);

  const generateScenario = async () => {
    setGameState('LOADING');
    try {
      const res = await fetch('http://localhost:8000/api/scenario/generate', { method: 'POST' });
      const data = await res.json();
      setScenario(data);
      setTimeRemaining(data.time_limit_seconds || 900);
      setTimeElapsed(0);
      setActionLog([]);
      setScore(0);
      setDebriefText('');
      
      const vSet = new Set<string>();
      (data.vulnerabilities || []).forEach((v: any) => vSet.add(v.id));
      setUnfixedVulns(vSet);

      setGameState('BRIEFING');
    } catch (err) {
      console.error("Failed to fetch scenario", err);
    }
  };

  const startGame = () => {
    setGameState('PLAYING');
  };

  const endGame = async () => {
    setGameState('DEBRIEF');
    // Calculate basic score
    let points = 0;
    actionLog.forEach(log => {
      if (log.vuln_fixed) {
        const v = scenario?.vulnerabilities.find(x => x.id === log.vuln_fixed);
        if (v) points += v.points;
      }
    });
    setScore(points);

    // Call LLM for debrief
    try {
      const res = await fetch('http://localhost:8000/api/scenario/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log: actionLog,
          vulnerabilities: scenario?.vulnerabilities || []
        })
      });
      const data = await res.json();
      setDebriefText(data.debrief || '');
    } catch (err) {
      setDebriefText('Failed to generate AI debrief.');
    }
  };

  const logAction = (action: string, resource: string, vuln_fixed?: string) => {
    setActionLog(prev => [...prev, { time_elapsed: timeElapsed, action, resource, vuln_fixed }]);
  };

  const fixVuln = (vulnId: string) => {
    if (unfixedVulns.has(vulnId)) {
      setUnfixedVulns(prev => {
        const next = new Set(prev);
        next.delete(vulnId);
        return next;
      });
    }
  };

  const markAttacked = (vulnId: string) => {
    if (unfixedVulns.has(vulnId)) {
      setUnfixedVulns(prev => {
         const next = new Set(prev);
         next.delete(vulnId);
         return next;
      });
      setActionLog(prev => [...prev, { time_elapsed: timeElapsed, action: 'ATTACK_SUCCESS', resource: 'SYSTEM', vuln_missed: vulnId }]);
    }
  };

  const resetGame = () => {
    setGameState('IDLE');
    setScenario(null);
  };

  return (
    <GameContext.Provider value={{
      gameState, scenario, timeRemaining, timeElapsed, actionLog, unfixedVulns, score, debriefText,
      generateScenario, startGame, endGame, logAction, resetGame, fixVuln, markAttacked
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within a GameProvider');
  return context;
};
