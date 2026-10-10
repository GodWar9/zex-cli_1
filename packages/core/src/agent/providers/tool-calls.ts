import type { ToolCallPayload } from '../types.ts';

// Buffer every call until the provider confirms the complete response. No partial
// or malformed batch reaches the runner, even if an earlier call looked valid.
export class ToolCallBuffer {
  private calls = new Map<number, { id: string; name: string; json: string }>();
  private bytes = 0;
  append(index: number, id = '', name = '', json = '') {
    if (!Number.isInteger(index) || index < 0 || index > 63) throw new Error('Invalid or excessive tool call index');
    this.bytes += Buffer.byteLength(id + name + json);
    if (this.bytes > 1024 * 1024) throw new Error('Tool call arguments exceed 1 MiB');
    const call = this.calls.get(index) ?? { id: '', name: '', json: '' };
    if (id && call.id && id !== call.id) throw new Error('Tool call ID changed during streaming');
    if (name && call.name && name !== call.name) throw new Error('Tool name changed during streaming');
    call.id ||= id;
    call.name ||= name;
    call.json += json;
    this.calls.set(index, call);
  }
  get size() { return this.calls.size; }
  finish(): ToolCallPayload[] {
    const seen = new Set<string>();
    return [...this.calls].sort(([a], [b]) => a - b).map(([, call]) => {
      if (!call.id || !call.name || seen.has(call.id)) throw new Error('Missing or duplicate tool call identity');
      seen.add(call.id);
      let args: unknown;
      try { args = JSON.parse(call.json); } catch { throw new Error('Tool arguments are incomplete or invalid JSON'); }
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object');
      return { id: call.id, name: call.name, args: args as Record<string, unknown> };
    });
  }
}
