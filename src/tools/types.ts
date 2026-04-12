export interface ToolCall {
  name: string;
  input: any;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>; // JSON schema
  execute: (input: any) => Promise<ToolResult>;
}
