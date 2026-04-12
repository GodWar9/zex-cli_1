import { readFileTool } from './read_file.ts';
import { writeFileTool } from './write_file.ts';
import { projectStatusTool } from './project_status.ts';
import { bashTool } from './bash.ts';
import { listDirectoryTool } from './list_directory.ts';
import { searchTool } from './search.ts';
import { patchFileTool } from './patch_file.ts';
import type { ToolDefinition } from './types.ts';

export const availableTools: ToolDefinition[] = [
  listDirectoryTool,   // 1st — agent should call this first to orient itself
  searchTool,          // 2nd — find things by content without asking the user
  readFileTool,        // 3rd — read specific files found via list/search
  patchFileTool,       // 4th — surgical edits
  writeFileTool,
  projectStatusTool,
  bashTool,
];




export function getTool(name: string): ToolDefinition | undefined {
  return availableTools.find(tool => tool.name === name);
}

export * from './types.ts';
