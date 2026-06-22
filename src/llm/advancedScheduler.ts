export interface ScheduledTask {
  id: string;
  prompt: string;
  model: string;
  priority: number;
  estimatedTokens: number;
  deadline?: number;
  status: "queued" | "assigned" | "executing" | "completed" | "failed";
  retries: number;
  maxRetries: number;
  queuedAt: number;
  deadlineUrgency: number;
  costToExecute: number;
  expectedCompletionTime: number;
  dynamicPriority: number;
  assignedKeyId?: string;
}

export class AdvancedScheduler {
  calculateDynamicPriority(
    task: ScheduledTask,
    now: number
  ): number {
    const userPriority = Math.min(10, Math.max(0, task.priority)) / 10;

    let deadlineUrgency = 0;
    if (task.deadline) {
      const timeRemaining = task.deadline - now;
      const baseTime = 3600000; // 1 hour baseline
      deadlineUrgency = Math.max(
        0,
        1 - (timeRemaining / baseTime)
      );
    }

    const costFactor = 1 / (1 + task.costToExecute);

    const dynamicPriority =
      (userPriority * 0.5) +
      (deadlineUrgency * 0.3) +
      (costFactor * 0.2);

    return Math.min(1.0, Math.max(0.0, dynamicPriority));
  }

  hasDeadlineConflict(task: ScheduledTask, now: number): boolean {
    if (!task.deadline) return false;
    const minutesRemaining = (task.deadline - now) / 60000;
    return minutesRemaining <= 5;
  }

  reorderQueue(queue: ScheduledTask[]): ScheduledTask[] {
    const now = Date.now();

    const critical = queue.filter(t => this.hasDeadlineConflict(t, now));
    const normal = queue.filter(t => !this.hasDeadlineConflict(t, now));

    critical.sort((a, b) => {
      if (!a.deadline || !b.deadline) return 0;
      return a.deadline - b.deadline;
    });

    normal.sort((a, b) => {
      const aPriority = this.calculateDynamicPriority(a, now);
      const bPriority = this.calculateDynamicPriority(b, now);
      return bPriority - aPriority;
    });

    return [...critical, ...normal];
  }
}
