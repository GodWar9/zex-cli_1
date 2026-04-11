export type ExecState = 'idle' | 'running' | 'stepping' | 'paused' | 'error' | 'done';

export interface Instruction {
  index: number;
  opcode: string;
  operand?: string | number;
  offset: number;
}

export interface StackFrame {
  id: string;
  label: string;
  value: string | number;
  type: 'int' | 'str' | 'ref' | 'bool';
}

export interface ExecutionEvent {
  program: string;
  currentIndex: number;
  opcode: string;
  operand?: string | number;
  stack: StackFrame[];
  instructionCount: number;
  state: ExecState;
  instructions: Instruction[];
}

export type NarrationTag = 'intent' | 'step' | 'warning' | 'error' | 'plain';

export interface NarrationToken {
  id: string;
  text: string;
  tag: NarrationTag;
}

export interface NarrationEvent {
  token: string;
  tag: NarrationTag;
  sequence: number;
}

export type Program = 'bubble_sort' | 'fibonacci' | 'infinite_loop_bug';

export interface VMMessage {
  type: 'exec' | 'narration';
  data: ExecutionEvent | NarrationEvent;
}
