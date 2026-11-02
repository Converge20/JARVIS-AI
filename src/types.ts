export type Priority = "high" | "medium" | "low";
export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  dueDate?: string;
}
export interface Message {
  local?: boolean;
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
export interface TaskProposal {
  id: string;
  kind: "create_task" | "update_task" | "delete_task";
  before?: Task;
  task?: Task;
}
