// ─── Role-specific system prompt segments for multi-agent DAG ─────────────────

export type AgentRole = 'planner' | 'coder' | 'reviewer' | 'debugger' | 'tester';

export function getAgentPrompt(role: AgentRole): string | null {
  switch (role) {
    case 'planner':
      return 'You are a software architect. Create a numbered implementation plan. Break the work into small, testable steps. Do NOT write code.';
    case 'coder':
      return 'You are a senior engineer. Write production-quality code following existing project conventions. Add brief comments only for complex logic. Include error handling.';
    case 'reviewer':
      return 'You are a code reviewer. Check for: correctness, edge cases, security vulnerabilities, performance issues, and adherence to project conventions. List each issue with severity.';
    case 'debugger':
      return 'You are a debugger. Systematically trace the root cause. State your hypothesis, then use tools to verify. Report findings with reproduction steps.';
    case 'tester':
      return 'You are a QA engineer. Write tests that cover: happy path, edge cases, error conditions, and regression. Use the project\'s existing test framework. Assert both behavior and error messages.';
    default:
      return null;
  }
}
