export type Priority = "high" | "medium" | "low";
export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
}
export interface Message {
  id: string;
  role: "assistant" | "user";
  content: string;
  time: string;
}
export interface Activity {
  id: string;
  text: string;
  time: string;
}
