import { Markdown } from "./Markdown";
import { BRAND } from "../config/brand";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, CornerDownLeft, MessageSquare, Sparkles } from "lucide-react";
import type { Message, TaskProposal } from "../types";
import { CONNECTION_LABELS } from "../services/assistant";
import type { Connection } from "../services/assistant";
export function Chat({
  messages,
  voiceTranscript,
  voiceCapturing,
  thinking,
  onSend,
  expanded = false,
  connection,
  onCheck,
  checkingConnection,
  connectionCheckedAt,
  error,
  proposals,
  onDecision,
  onClear,
}: {
  messages: Message[];
  voiceTranscript: string;
  voiceCapturing: boolean;
  thinking: boolean;
  onSend: (text: string) => void;
  expanded?: boolean;
  onClear: () => void;
  connection: Connection;
  onCheck: () => void;
  checkingConnection: boolean;
  connectionCheckedAt: string;
  error: string;
  proposals: TaskProposal[];
  onDecision: (proposal: TaskProposal, confirmed: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll the message log only; keep voice stop/mute controls in the user's viewport.
    const log = end.current?.parentElement;
    if (log && messages.length > 1) log.scrollTop = log.scrollHeight;
  }, [messages, thinking]);

  return (
    <section
      className={`panel chat-panel ${expanded ? "expanded" : ""}`}
      aria-label="Conversation"
    >
      <div className="panel-heading">
        <div className="heading-inline">
          <MessageSquare size={17} />
          <h2>Conversation</h2>
        </div>
        <span className="demo-tag">
          <i />
          {CONNECTION_LABELS[connection.status]}
        </span>
      </div>
      <div
        className="chat-messages"
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
      >
        {messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            <div className="message-avatar">
              {m.role === "assistant" ? <Sparkles size={15} /> : "Y"}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <b>{m.role === "assistant" ? BRAND.name : "YOU"}</b>
                <time>{m.time}</time>
                {m.local && <span>WORKSPACE</span>}
              </div>
              {m.role === "assistant" ? (
                <Markdown content={m.content} />
              ) : (
                <p>{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="typing" role="status" aria-label="AI request status">
            <i />
            <i />
            <i />
            <span>{BRAND.name} is processing your request</span>
          </div>
        )}
        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}
        {proposals.map((proposal) => (
          <div className="task-proposal" key={proposal.id}>
            <b>Confirm {proposal.kind.replace("_task", "")} task</b>
            {proposal.before && (
              <p>
                Current: {proposal.before.title} · {proposal.before.priority} ·{" "}
                {proposal.before.completed ? "complete" : "outstanding"}
                {proposal.before.dueDate && ` · due ${proposal.before.dueDate}`}
              </p>
            )}
            {proposal.task && (
              <p>
                Proposed: {proposal.task.title} · {proposal.task.priority} ·{" "}
                {proposal.task.completed ? "complete" : "outstanding"}
                {proposal.task.dueDate && ` · due ${proposal.task.dueDate}`}
              </p>
            )}
            <p>
              No change has been saved. Review the details before confirming.
            </p>
            <button
              className="text-button"
              onClick={() => onDecision(proposal, true)}
            >
              Confirm task change
            </button>
            <button
              className="text-button"
              onClick={() => onDecision(proposal, false)}
            >
              Cancel task change
            </button>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="chat-bottom">
        {voiceCapturing && (
          <p
            className="voice-transcript"
            role="status"
            aria-label="Live speech transcript"
          >
            {voiceTranscript
              ? `Heard: ${voiceTranscript}`
              : "Speak your question…"}
          </p>
        )}
        <div className="suggestions">
          <button
            disabled={thinking || voiceCapturing || proposals.length > 0}
            onClick={onClear}
          >
            New conversation
          </button>
          {["Plan my day", "What can you do?"].map((text) => (
            <button
              disabled={thinking || voiceCapturing || proposals.length > 0}
              key={text}
              onClick={() => onSend(text)}
            >
              {text}
              <ArrowUp size={11} />
            </button>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              input.trim() &&
              !thinking &&
              !voiceCapturing &&
              !proposals.length
            ) {
              onSend(input.trim());
              setInput("");
            }
          }}
        >
          <input
            aria-label={`Message ${BRAND.name}`}
            maxLength={2000}
            placeholder={`Ask ${BRAND.name} anything…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <kbd>
            <CornerDownLeft size={12} />
          </kbd>
          <button
            aria-label="Send message"
            disabled={
              !input.trim() ||
              thinking ||
              voiceCapturing ||
              proposals.length > 0
            }
          >
            <ArrowUp size={18} />
          </button>
        </form>
        <div
          className="connection-feedback"
          role="status"
          aria-label="Connection check result"
          aria-live="polite"
          aria-busy={checkingConnection}
        >
          <strong>
            {checkingConnection
              ? "Checking connection…"
              : CONNECTION_LABELS[connection.status]}
          </strong>
          <p>
            {checkingConnection
              ? "Checking the application server and preview access…"
              : connection.message}
          </p>
          {!checkingConnection && connectionCheckedAt && (
            <small>
              Checked at {connectionCheckedAt} · Server and configuration check;
              no Groq inference request.
            </small>
          )}
          <button
            type="button"
            className="text-button"
            onClick={onCheck}
            disabled={thinking || checkingConnection}
          >
            {checkingConnection ? "Checking…" : "Check connection"}
          </button>
        </div>
        <div className="chat-disclaimer">
          <span className="status-dot" />
          Session history · AI requests send messages and task context to Groq.
        </div>
      </div>
    </section>
  );
}
