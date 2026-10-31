import { useEffect, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  AudioLines,
  ArrowUpRight,
  Bell,
  Blocks,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Command,
  Cpu,
  ExternalLink,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  MessageSquare,
  Mic,
  Monitor,
  Pause,
  Play,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  Timer,
  Wifi,
  X,
} from "lucide-react";
import { Core, Waveform } from "./components/Core";
import { Tasks } from "./components/Tasks";
import { Chat } from "./components/Chat";
import { useTasks } from "./hooks/useTasks";
import { assistant } from "./services/assistant";
import type { Activity, Message, Task } from "./types";
const stamp = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Conversation", icon: MessageSquare },
  { name: "Tasks", icon: ListTodo },
  { name: "Activity", icon: ActivityIcon },
  { name: "Integrations", icon: Blocks },
];
export default function App() {
  const [page, setPage] = useState("Overview");
  const [now, setNow] = useState(new Date());
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [motion, setMotion] = useState(true);
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const { tasks, setTasks, error, replaceStorage } = useTasks();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      time: stamp(),
      content:
        "Welcome back. Your workspace is ready, and I’m standing by. What would you like to focus on today?",
    },
  ]);
  const [activity, setActivity] = useState<Activity[]>([
    { id: "boot", text: "Command center initialized", time: stamp() },
    { id: "local", text: "Local workspace ready", time: stamp() },
  ]);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!listening) return;
    const timer = setTimeout(() => setListening(false), 8000);
    return () => clearTimeout(timer);
  }, [listening]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSettings(false);
        setHelp(false);
        setNotifications(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPage("Conversation");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>('[aria-label="Message JARVIS"]')
              ?.focus(),
          0,
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  function log(text: string) {
    setActivity((a) =>
      [{ id: crypto.randomUUID(), text, time: stamp() }, ...a].slice(0, 30),
    );
  }
  function changeTasks(next: Task[], event: string) {
    setTasks(next);
    log(event);
  }
  async function send(text: string) {
    if (busy.current) return;
    busy.current = true;
    setThinking(true);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: text, time: stamp() },
    ]);
    try {
      const content = await assistant.reply(text, { tasks });
      if (alive.current) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            time: stamp(),
          },
        ]);
        log("Simulated response generated");
      }
    } catch {
      if (alive.current)
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "The demo response could not be generated. Please try again.",
            time: stamp(),
          },
        ]);
    } finally {
      busy.current = false;
      if (alive.current) setThinking(false);
    }
  }
  const complete = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - complete;
  const percent = tasks.length
    ? Math.round((complete / tasks.length) * 100)
    : 0;
  function voice() {
    setListening((v) => !v);
    log(
      listening ? "Voice demonstration stopped" : "Voice demonstration started",
    );
  }
  return (
    <div className={`app ${motion ? "" : "motion-paused"}`}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
          aria-label="JARVIS home"
        >
          <div className="brand-mark">
            <span>J</span>
          </div>
          <div>
            JARVIS<span>PERSONAL INTELLIGENCE</span>
          </div>
        </a>
        <div className="workspace-tag">
          <span className="status-dot" />
          PERSONAL WORKSPACE <ChevronRight size={13} />
        </div>
        <div className="nav-label">COMMAND CENTER</div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={page === name ? "active" : ""}
              onClick={() => setPage(name)}
            >
              <Icon size={18} />
              {name}
              {name === "Tasks" && <span className="nav-count">{pending}</span>}
              {page === name && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={20} />
            <b>Your space. Your control.</b>
            <p>
              Local-first. No external services.
              <br />
              Built around your privacy.
            </p>
            <span>
              <i />
              SECURE ENVIRONMENT
            </span>
          </div>
          <button className="utility" onClick={() => setSettings(true)}>
            <Settings2 size={17} />
            Preferences
          </button>
          <button className="utility" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            Help & information
            <ArrowUpRight size={13} />
          </button>
          <div className="profile">
            <div className="profile-avatar">U</div>
            <div>
              Personal workspace<small>Prototype v0.1.0</small>
            </div>
            <span className="status-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumbs">
            Workspace <ChevronRight size={13} />
            <span>{page}</span>
          </div>
          <div className="topbar-right">
            <span className="local-label">
              <Wifi size={14} /> Local mode
            </span>
            <span className="header-date">
              {now.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              className={`icon-button notification-button ${notifications ? "chosen" : ""}`}
              aria-label="Session notifications"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={17} />
              <i />
            </button>
            <button
              className="icon-button compact-utility"
              aria-label="Open preferences"
              onClick={() => setSettings(true)}
            >
              <Settings2 size={17} />
            </button>
            <button
              className="icon-button compact-utility"
              aria-label="Open help"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={17} />
            </button>
            <div className="small-avatar">U</div>
          </div>
          {notifications && (
            <div className="notification-popover">
              <b>Session activity</b>
              <p>{activity[0].text}</p>
              <small>{activity[0].time} · This session only</small>
            </div>
          )}
        </header>
        <div className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-dash" />
                YOUR PERSONAL INTELLIGENCE SYSTEM
              </div>
              <h1>
                {page === "Overview"
                  ? "A clearer mind. A sharper day."
                  : page === "Conversation"
                    ? "A little clarity, on command."
                    : page === "Tasks"
                      ? "Make room for what matters."
                      : page === "Activity"
                        ? "Every action, in view."
                        : "A connected future."}
              </h1>
              <p>
                {page === "Overview"
                  ? "Everything you need. One intelligent workspace."
                  : page === "Conversation"
                    ? "Explore a conversation with your personal assistant."
                    : page === "Tasks"
                      ? "Turn your ideas into focused, achievable objectives."
                      : page === "Activity"
                        ? "A transparent record of this workspace session."
                        : "Your command center is designed to grow with you."}
              </p>
            </div>
            <div className="online-badge">
              <span className="status-dot" />
              SYSTEM ONLINE<span>v0.1</span>
            </div>
          </div>
          {error && (
            <div className="storage-warning" role="alert">
              {error}
              <button onClick={replaceStorage}>
                Retry / replace saved data
              </button>
            </div>
          )}
          {(page === "Overview" || page === "Tasks") && (
            <div className="stats-grid">
              <div className="stat">
                <span className="stat-icon cyan">
                  <Cpu size={19} />
                </span>
                <div>
                  <small>Assistant status</small>
                  <strong>
                    Standing by <span className="status-dot" />
                  </strong>
                  <span>Ready when you are</span>
                </div>
                <span className="stat-code">01</span>
              </div>
              <div className="stat">
                <span className="stat-icon violet">
                  <ListTodo size={19} />
                </span>
                <div>
                  <small>Pending tasks</small>
                  <strong>
                    {String(pending).padStart(2, "0")} <em>objectives</em>
                  </strong>
                  <span>
                    {
                      tasks.filter((t) => !t.completed && t.priority === "high")
                        .length
                    }{" "}
                    high priority
                  </span>
                </div>
                <span className="stat-code">02</span>
              </div>
              <div className="stat">
                <span className="stat-icon green">
                  <CheckCheck size={19} />
                </span>
                <div>
                  <small>Completed</small>
                  <strong>
                    {String(complete).padStart(2, "0")} <em>tasks</em>
                  </strong>
                  <span>{percent}% of your task list</span>
                </div>
                <span className="mini-bars" aria-hidden="true">
                  {[9, 16, 12, 22, 18, 29, 24, 34].map((h, i) => (
                    <i key={i} style={{ height: h }} />
                  ))}
                </span>
              </div>
              <div className="stat">
                <span className="stat-icon blue">
                  <Timer size={19} />
                </span>
                <div>
                  <small>Local time</small>
                  <strong className="clock">
                    {now.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                    <em>
                      {now
                        .toLocaleTimeString([], { second: "2-digit" })
                        .slice(-2)}
                    </em>
                  </strong>
                  <span>
                    {now.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="overview-grid">
                <section className="panel intelligence-panel">
                  <div className="panel-heading">
                    <div className="heading-inline">
                      <span className="status-dot" />
                      <h2>Intelligence core</h2>
                    </div>
                    <span className="mono muted">J.A.R.V.I.S. / V.01</span>
                  </div>
                  <Core listening={listening} thinking={thinking} />
                  <div className="core-bottom">
                    <div>
                      <span className="eyebrow">PERSONAL ASSISTANT</span>
                      <p>Consider it handled.</p>
                    </div>
                    <div className="core-ready">
                      <i />
                      ALL SYSTEMS READY
                    </div>
                  </div>
                </section>
                <div className="right-stack">
                  <section
                    className={`panel voice-panel ${listening ? "listening" : ""}`}
                  >
                    <div className="panel-heading">
                      <div className="heading-inline">
                        <AudioLines size={17} />
                        <h2>Voice interface</h2>
                      </div>
                      <span className="demo-tag">DEMO</span>
                    </div>
                    <Waveform active={listening} />
                    <p>
                      {listening
                        ? "Listening simulation active…"
                        : "Your voice. Your command."}
                    </p>
                    <small>
                      {listening
                        ? "Visual demo · stops after 8 seconds"
                        : "A preview of hands-free assistance"}
                    </small>
                    <button
                      className={`voice-button ${listening ? "active" : ""}`}
                      onClick={voice}
                    >
                      <Mic size={16} />
                      {listening ? "Stop demonstration" : "Activate voice"}
                      <span aria-hidden="true">
                        {listening ? (
                          <span className="status-dot" />
                        ) : (
                          <ArrowUpRight size={13} />
                        )}
                      </span>
                    </button>
                    <div className="voice-foot">
                      <LockKeyhole size={11} />
                      Microphone is not accessed
                    </div>
                  </section>
                  <Tasks tasks={tasks} onChange={changeTasks} />
                </div>
              </div>
              <div className="bottom-grid">
                <Chat messages={messages} thinking={thinking} onSend={send} />
                <section className="panel system-panel">
                  <div className="panel-heading">
                    <div className="heading-inline">
                      <ActivityIcon size={17} />
                      <h2>System overview</h2>
                    </div>
                    <span className="status-dot" />
                  </div>
                  <div className="system-row">
                    <span>
                      <Radio size={15} />
                      Assistant engine
                    </span>
                    <b className="cyan-text">Demo mode</b>
                  </div>
                  <div className="system-row">
                    <span>
                      <Monitor size={15} />
                      Workspace
                    </span>
                    <b>Local browser</b>
                  </div>
                  <div className="system-row">
                    <span>
                      <ShieldCheck size={15} />
                      Data storage
                    </span>
                    <b className={error ? "" : "green-text"}>
                      {error ? "Session only" : "On this device"}
                    </b>
                  </div>
                  <div className="system-row">
                    <span>
                      <Blocks size={15} />
                      External services
                    </span>
                    <b>Not connected</b>
                  </div>
                  <div className="activity-preview">
                    <div className="eyebrow">
                      RECENT ACTIVITY{" "}
                      <button
                        aria-label="View all activity"
                        onClick={() => setPage("Activity")}
                      >
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                    {activity.slice(0, 2).map((a) => (
                      <div key={a.id}>
                        <i />
                        <span>{a.text}</span>
                        <time>{a.time}</time>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "Conversation" && (
            <Chat
              messages={messages}
              thinking={thinking}
              onSend={send}
              expanded
            />
          )}
          {page === "Tasks" && (
            <div className="wide-panel">
              <Tasks tasks={tasks} onChange={changeTasks} expanded />
            </div>
          )}
          {page === "Activity" && (
            <section className="panel activity-full">
              <div className="panel-heading">
                <h2>Session activity</h2>
                <span className="demo-tag">{activity.length} EVENTS</span>
              </div>
              <p className="muted">
                Actual interface events from this session. No computer telemetry
                is collected.
              </p>
              {activity.map((a) => (
                <div className="activity-event" key={a.id}>
                  <span className="event-icon">
                    <Check size={14} />
                  </span>
                  <span>{a.text}</span>
                  <time>{a.time}</time>
                </div>
              ))}
            </section>
          )}
          {page === "Integrations" && (
            <div className="integration-grid">
              {[
                {
                  icon: Sparkles,
                  name: "AI conversations",
                  text: "Context-aware assistance, powered by a future server-side AI provider.",
                },
                {
                  icon: Mic,
                  name: "Real-time voice",
                  text: "Natural voice interaction with explicit microphone permission.",
                },
                {
                  icon: Timer,
                  name: "Calendar & reminders",
                  text: "A unified view of your schedule and upcoming priorities.",
                },
                {
                  icon: MessageSquare,
                  name: "Email assistance",
                  text: "Thoughtful support for your inbox, connected on your terms.",
                },
                {
                  icon: Command,
                  name: "Mac application controls",
                  text: "Approved actions with clear permissions and confirmation.",
                },
                {
                  icon: ShieldCheck,
                  name: "Personal memory",
                  text: "Optional preferences and context, always under your control.",
                },
              ].map(({ icon: Icon, name, text }) => (
                <section className="panel integration" key={name}>
                  <Icon size={25} />
                  <span className="demo-tag">PLANNED</span>
                  <h2>{name}</h2>
                  <p>{text}</p>
                  <span className="muted">
                    <LockKeyhole size={12} />
                    Not connected · Future milestone
                  </span>
                </section>
              ))}
            </div>
          )}
          <footer>
            <span>
              <span className="footer-logo">J</span>JARVIS <i /> Designed for a
              more focused you.
            </span>
            <span>
              <span className="status-dot" />
              LOCAL-FIRST PROTOTYPE <i /> NO API KEYS REQUIRED
            </span>
          </footer>
        </div>
      </main>
      {(settings || help) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setSettings(false);
            setHelp(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={settings ? "Preferences" : "Help and information"}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                const nodes =
                  e.currentTarget.querySelectorAll<HTMLElement>("button,a");
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <div className="panel-heading">
              <h2>
                {settings ? "Your preferences" : "Meet your command center"}
              </h2>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close dialog"
                onClick={() => {
                  setSettings(false);
                  setHelp(false);
                }}
              >
                <X size={18} />
              </button>
            </div>
            {settings ? (
              <>
                <p>Adjust this session’s visual experience.</p>
                <button
                  className="preference-row"
                  aria-pressed={motion}
                  onClick={() => setMotion(!motion)}
                >
                  {motion ? <Pause size={16} /> : <Play size={16} />}Ambient
                  animations<span>{motion ? "On" : "Paused"}</span>
                </button>
                <small className="muted">
                  Your device’s reduced-motion preference is also respected.
                </small>
              </>
            ) : (
              <>
                <p>
                  JARVIS is a local-first personal assistant prototype. Create
                  and prioritize tasks, try scripted conversations, and explore
                  the simulated voice interface.
                </p>
                <p>
                  Tasks persist in this browser. Conversations and activity last
                  for this session. No microphone, AI API, email, calendar, or
                  Mac controls are connected.
                </p>
                <div className="shortcut">
                  <kbd>⌘ / Ctrl + K</kbd> Open conversation
                </div>
                <a
                  className="text-button"
                  href="https://github.com/Converge20/JARVIS-AI"
                  target="_blank"
                  rel="noreferrer"
                >
                  Project on GitHub
                  <ExternalLink size={14} />
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
