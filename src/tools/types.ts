export interface ToolCall {
  name: string;
  input: any;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
  /** Optional structured payload for TOON encoding in runner.ts.
   *  Only set by tools that return uniform arrays (list_directory, search_files).
   *  Runner uses this instead of trying to JSON.parse the content string. */
  structuredData?: unknown; // zex: added for toon-encoding
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>; // JSON schema
  execute: (input: any) => Promise<ToolResult>;
}
