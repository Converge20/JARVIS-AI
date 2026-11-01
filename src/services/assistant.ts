import type { Message, Task, TaskProposal } from "../types";
export interface Connection {
  status:
    | "configuration_required"
    | "disabled"
    | "ready"
    | "connected"
    | "unavailable";
  message: string;
  model?: string;
}
export interface AssistantReply {
  content: string;
  proposals: TaskProposal[];
  events: ("retrieval" | "task")[];
  model: string;
}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(50000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "The assistant request failed.");
    return data as T;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message &&
      !(error instanceof TypeError) &&
      !(error instanceof SyntaxError) &&
      error.name !== "TimeoutError"
    )
      throw error;
    throw new Error(
      "Assistant server unavailable or timed out. Start the backend and check your connection. No automatic retry was made.",
    );
  }
}
export const assistant = {
  status: () => request<Connection>("/api/status"),
  reply(messages: Message[], tasks: Task[]): Promise<AssistantReply> {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        today,
        messages: messages
          .filter((m) => !m.local)
          .slice(-20)
          .map(({ role, content }) => ({ role, content })),
        tasks,
      }),
    });
  },
};
export const CONNECTION_LABELS: Record<Connection["status"], string> = {
  configuration_required: "Configuration required",
  disabled: "AI disabled",
  ready: "Configured · not verified",
  connected: "Groq connected",
  unavailable: "AI unavailable",
};
