import type { Task } from "../types";
// Replace this provider with a server-backed implementation. Never put API keys in the browser.
export interface AssistantProvider {
  reply(prompt: string, context: { tasks: Task[] }): Promise<string>;
}
export const assistant: AssistantProvider = {
  async reply(prompt, { tasks }) {
    await new Promise((resolve) => setTimeout(resolve, 850));
    const text = prompt.toLowerCase();
    const pending = tasks.filter((t) => !t.completed);
    if (/task|priorit|brief|plan my day/.test(text))
      return pending.length
        ? `You have ${pending.length} pending ${pending.length === 1 ? "task" : "tasks"}. I suggest starting with “${[...pending].sort((a, b) => ["high", "medium", "low"].indexOf(a.priority) - ["high", "medium", "low"].indexOf(b.priority))[0].title}”. Keep your focus on one objective at a time. You can manage your list in the Tasks panel.`
        : "Your task list is clear. Add your next objective in the Tasks panel when you are ready.";
    if (/time|date/.test(text))
      return `Your local date and time is ${new Date().toLocaleString()}. The live clock is always available in your command center.`;
    if (/can you|help|capabilit/.test(text))
      return "I can help you explore this prototype, review your task priorities, and demonstrate conversation. Tasks are saved in this browser. My replies are scripted; live AI, real voice, calendar, email, and device controls are not connected.";
    if (/hello|hi\b|hey/.test(text))
      return "Good to have you here. Your workspace is ready. Shall we review your priorities or set a new objective?";
    return "Acknowledged. This is a scripted demonstration of the JARVIS conversation interface. For a useful preview, ask me to review your tasks, check the time, or explain my capabilities.";
  },
};
