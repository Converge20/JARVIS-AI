import { useEffect, useRef, useState } from "react";
import { ArrowUp, CornerDownLeft, MessageSquare, Sparkles } from "lucide-react";
import type { Message } from "../types";
export function Chat({
  messages,
  thinking,
  onSend,
  expanded = false,
}: {
  messages: Message[];
  thinking: boolean;
  onSend: (text: string) => void;
  expanded?: boolean;
}) {
  const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length > 1)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
          SIMULATED AI
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
                <b>{m.role === "assistant" ? "JARVIS" : "YOU"}</b>
                <time>{m.time}</time>
                {m.role === "assistant" && <span>DEMO</span>}
              </div>
              <p>{m.content}</p>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="typing" role="status">
            <i />
            <i />
            <i />
            <span>JARVIS is composing a simulated reply</span>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="chat-bottom">
        <div className="suggestions">
          {["Plan my day", "What can you do?"].map((text) => (
            <button disabled={thinking} key={text} onClick={() => onSend(text)}>
              {text}
              <ArrowUp size={11} />
            </button>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim() && !thinking) {
              onSend(input.trim());
              setInput("");
            }
          }}
        >
          <input
            aria-label="Message JARVIS"
            maxLength={2000}
            placeholder="Ask JARVIS anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <kbd>
            <CornerDownLeft size={12} />
          </kbd>
          <button
            aria-label="Send message"
            disabled={!input.trim() || thinking}
          >
            <ArrowUp size={18} />
          </button>
        </form>
        <div className="chat-disclaimer">
          <span className="status-dot" />
          Private by design. Conversations stay in this session.
          <span>Scripted responses · No API connected</span>
        </div>
      </div>
    </section>
  );
}
