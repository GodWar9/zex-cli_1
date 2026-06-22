export class LLMRouter {
  selectBestModel(
    taskType: "coding" | "analysis" | "creative" | "summary",
    options: {
      preferCheap?: boolean;
    } = {}
  ): string {
    if (options.preferCheap) {
      return "gemini-2.0-flash";
    }

    switch (taskType) {
      case "coding":
        return "claude-3-sonnet";
      case "analysis":
        return "gpt-4o";
      case "creative":
        return "claude-3-opus";
      case "summary":
        return "gpt-4o-mini";
      default:
        return "gpt-4o-mini";
    }
  }
}
