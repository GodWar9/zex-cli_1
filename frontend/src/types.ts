export type ExecState = 'idle' | 'running' | 'paused' | 'error' | 'done';

export interface SimulatedStep {
  step_index: number;
  line_number?: number | null;
  source_line?: string | null;
  variables: Record<string, any>;
  output?: string | null;
  intent?: string | null;
  warning?: string | null;
}

export type NarrationTag = 'intent' | 'step' | 'warning' | 'error' | 'plain';

export interface NarrationToken {
  id: string;
  text: string;
  tag: NarrationTag;
}

export interface VMMessage {
  type: 'sim_step' | 'info' | 'error' | 'tick' | 'narration';
  data: any; 
}

// --- Scheduler Types ---

export type ProcessState = 'ready' | 'running' | 'waiting' | 'done';

export interface ProcessInfo {
  pid: number;
  name: string;
  priority: number;
  state: ProcessState;
  remaining_burst: number;
  wait_ticks: number;
  network_demand: number;
  io_wait: number;
}

export interface SchedulerMetrics {
  cpu_utilisation: number;
  avg_latency: number;
  throughput: number;
  fairness_index: number;
  bandwidth_usage: number;
}

export interface AgentAction {
  scheduled_pid: number | null;
  bandwidth_alloc: Record<string, number>;
}

export interface SchedulerEvent {
  tick: number;
  processes: ProcessInfo[];
  metrics: SchedulerMetrics;
  agent_action: AgentAction;
  agent_mode: 'heuristic' | 'ppo';
}
