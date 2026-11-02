import { useEffect, useRef, useState } from "react";
import {
  Activity as ActivityIcon,
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
import { VoicePanel, VoiceSettings } from "./components/VoicePanel";
import { useBrowserVoice } from "./hooks/useBrowserVoice";
import { NeuralPanel } from "./components/neural/NeuralPanel";
import { NEURAL_MODES } from "./components/neural/activity";
import { useNeuralActivity } from "./hooks/useNeuralActivity";
import { BRAND } from "./config/brand";
import { Tasks } from "./components/Tasks";
import { Chat } from "./components/Chat";
import { useTasks } from "./hooks/useTasks";
import { assistant, CONNECTION_LABELS } from "./services/assistant";
import type { Connection } from "./services/assistant";
import { applyTaskProposal } from "./services/taskActions";
import type { Activity, Message, Task, TaskProposal } from "./types";
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
  const neural = useNeuralActivity();
  const [thinking, setThinking] = useState(false);
  const [connection, setConnection] = useState<Connection>({
    status: "unavailable",
    message: "Checking assistant server…",
  });
  const [chatError, setChatError] = useState("");
  const [proposals, setProposals] = useState<TaskProposal[]>([]);
  const voice = useBrowserVoice({
    canListen: () => !busy.current && !proposals.length,
    onTranscript: (text) => {
      void send(text);
    },
    onPhase: (phase) => {
      if (phase === "listening") neural.activate("listening");
      else if (phase === "speaking") neural.activate("responding");
      else if (phase === "transcribing") neural.activate("analyzing");
      else if (phase === "idle" && !busy.current) neural.activate("idle");
    },
    onError: () => {
      if (!busy.current) neural.activate("error", 2200);
    },
  });
  useEffect(() => {
    voice.cancelListening();
    voice.stopSpeaking();
  }, [page]);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionCheckedAt, setConnectionCheckedAt] = useState("");
  const checkBusy = useRef(false);
  const connectionRevision = useRef(0);
  async function checkConnection() {
    if (checkBusy.current) return;
    checkBusy.current = true;
    const token = ++connectionRevision.current;
    setCheckingConnection(true);
    try {
      const next = await assistant.status();
      if (alive.current && token === connectionRevision.current) {
        setConnection((previous) =>
          next.status === "ready" &&
          previous.status === "connected" &&
          previous.model === next.model
            ? {
                ...next,
                status: "connected",
                message:
                  "Application server reachable; preview origin accepted. Your last Groq reply succeeded. No new inference request was made by this check.",
              }
            : next,
        );
        setConnectionCheckedAt(new Date().toLocaleTimeString());
      }
    } catch (error) {
      if (alive.current && token === connectionRevision.current) {
        setConnection({
          status: "unavailable",
          message:
            error instanceof Error
              ? error.message
              : "Assistant server unavailable.",
        });
        setConnectionCheckedAt(new Date().toLocaleTimeString());
      }
    } finally {
      checkBusy.current = false;
      if (alive.current) setCheckingConnection(false);
    }
  }
  useEffect(() => {
    void checkConnection();
  }, []);
  const [motion, setMotion] = useState(true);
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const { tasks, setTasks, error, replaceStorage } = useTasks();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      local: true,
      role: "assistant",
      time: stamp(),
      content:
        "Your workspace is ready. Connect Groq to ask questions and manage tasks in conversation. Tasks are also available locally. Voice is available on supported browsers; activate it only when you want to speak.",
    },
  ]);
  const [activity, setActivity] = useState<Activity[]>([
    { id: "boot", text: "Command center initialized", time: stamp() },
    { id: "local", text: "Local workspace ready", time: stamp() },
  ]);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    document.title = `${BRAND.name} — ${BRAND.tagline.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}`;
    alive.current = true;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
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
              .querySelector<HTMLInputElement>(
                `[aria-label="Message ${BRAND.name}"]`,
              )
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
    neural.activate("task", 3500, 3);
  }
  async function send(text: string) {
    if (busy.current || proposals.length || !text.trim()) return;
    voice.cancelListening();
    voice.stopSpeaking();
    const speechToken = voice.replyToken();
    busy.current = true;
    ++connectionRevision.current; // An older probe must not overwrite this request result.
    setThinking(true);
    setChatError("");
    const token = neural.activate("analyzing");
    const history: Message[] = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        time: stamp(),
      },
    ];
    setMessages(history);
    try {
      const reply = await assistant.reply(history, tasks);
      if (alive.current) {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: reply.content,
            time: stamp(),
          },
        ]);
        setProposals(reply.proposals);
        setConnection({
          status: "connected",
          message: "Last Groq request succeeded.",
          model: reply.model,
        });
        log("Groq text response received");
        // Retrieval animation acknowledges a completed real tool call, not inferred cognition.
        const retrieved = reply.events.includes("retrieval");
        if (retrieved) log("Local task retrieval completed");
        neural.finish(
          token,
          retrieved ? "retrieval" : "idle",
          retrieved ? 1800 : 0,
        );
        voice.speak(reply.content, speechToken);
      }
    } catch (error) {
      if (alive.current) {
        const message =
          error instanceof Error ? error.message : "Assistant request failed.";
        setChatError(message);
        setConnection((c) => ({ ...c, status: "unavailable", message }));
        log("AI request failed; no task changes applied");
        neural.finish(token, "error", 2200);
      }
    } finally {
      busy.current = false;
      if (alive.current) setThinking(false);
    }
  }
  function decide(proposal: TaskProposal, confirmed: boolean) {
    if (!proposals.some((p) => p.id === proposal.id)) return;
    let content = "Task proposal cancelled. No change was saved.";
    if (confirmed) {
      try {
        const next = applyTaskProposal(tasks, proposal);
        changeTasks(next, "Confirmed task operation applied");
        content = `Application result: ${proposal.kind.replace("_", " ")} applied to “${proposal.task?.title ?? proposal.before?.title}”. ${error ? "Storage is unavailable; this change is session-only." : "Applied to the local task list."}`;
      } catch (error) {
        content =
          error instanceof Error ? error.message : "Task change failed.";
        setChatError(content);
      }
    }
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "assistant", content, time: stamp() },
    ]);
    setProposals((p) => p.filter((item) => item.id !== proposal.id));
  }
  const chatProps = {
    onClear: () => {
      setMessages([]);
      setChatError("");
      log("Conversation cleared");
    },
    messages,
    voiceTranscript: voice.transcript,
    voiceCapturing: ["requesting", "listening", "transcribing"].includes(
      voice.phase,
    ),
    thinking,
    onSend: send,
    connection,
    onCheck: checkConnection,
    checkingConnection,
    connectionCheckedAt,
    error: chatError,
    proposals,
    onDecision: decide,
  };
  const voicePanelProps = {
    voice,
    processing: thinking,
    locked: proposals.length > 0,
    lastReply:
      [...messages].reverse().find((m) => m.role === "assistant" && !m.local)
        ?.content ?? "",
  };
  const complete = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - complete;
  const percent = tasks.length
    ? Math.round((complete / tasks.length) * 100)
    : 0;
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
          aria-label={`${BRAND.name} home`}
        >
          <div className="brand-mark">
            <span>{BRAND.monogram}</span>
          </div>
          <div>
            {BRAND.name}
            <span>{BRAND.tagline}</span>
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
              Tasks stay local. AI is opt-in.
              <br />
              You control API usage.
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
              Personal workspace<small>Prototype v{BRAND.version}</small>
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
              <Wifi size={14} /> {CONNECTION_LABELS[connection.status]}
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
                <span className="tiny-dash" />A NEW FRONTIER OF PERSONAL
                INTELLIGENCE
              </div>
              <h1>
                {page === "Overview"
                  ? "Intelligence. Reimagined."
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
                  ? "A living interface for your ideas, tasks, and next big move."
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
              WORKSPACE READY<span>v0.3</span>
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
                    {NEURAL_MODES[neural.mode].label}{" "}
                    <span className="status-dot" />
                  </strong>
                  <span>Activity visualisation · not cognition</span>
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
                <NeuralPanel
                  mode={neural.mode}
                  variant={neural.variant}
                  motion={motion}
                  onMode={(mode) => {
                    neural.activate(mode, mode === "idle" ? 0 : 8000);
                    log(`Neural state preview: ${NEURAL_MODES[mode].label}`);
                  }}
                  onScenario={(scenario) => {
                    neural.activate(scenario.mode, 8000, scenario.variant);
                    log(`Neural scenario preview: ${scenario.command}`);
                  }}
                />
                <div className="right-stack">
                  <VoicePanel {...voicePanelProps} />
                  <Tasks tasks={tasks} onChange={changeTasks} />
                  <section
                    className="panel neural-legend"
                    aria-label="Visualization guide"
                  >
                    <div className="eyebrow">A LANGUAGE OF LIGHT</div>
                    <h2>Activity, made visible.</h2>
                    <div>
                      <i className="legend-blue" />
                      <span>Blue pathways</span>
                      <small>Ambient & listening</small>
                    </div>
                    <div>
                      <i className="legend-orange" />
                      <span>Orange signals</span>
                      <small>Selected activity</small>
                    </div>
                    <div>
                      <i className="legend-white" />
                      <span>Luminous nodes</span>
                      <small>Simulated activation</small>
                    </div>
                    <p>
                      Animations illustrate app activity, never measured
                      cognition. Manual controls are visual previews.
                    </p>
                  </section>
                </div>
              </div>
              <div className="bottom-grid">
                <Chat {...chatProps} />
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
                    <b className="cyan-text">
                      {CONNECTION_LABELS[connection.status]}
                    </b>
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
                    <b>
                      {connection.status === "connected"
                        ? "Groq text"
                        : "Not verified"}
                    </b>
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
            <>
              <VoicePanel {...voicePanelProps} />
              <Chat {...chatProps} expanded />
            </>
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
                  text: "Server-backed Groq text conversations and confirmed task commands. Configure and enable the server to connect.",
                },
                {
                  icon: Mic,
                  name: "Real-time voice",
                  text: "Push-to-talk recognition and selectable browser speech, with explicit microphone activation.",
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
                  <span className="demo-tag">
                    {name === "AI conversations"
                      ? CONNECTION_LABELS[connection.status]
                      : name === "Real-time voice" ? "BROWSER VOICE" : "PLANNED"}
                  </span>
                  <h2>{name}</h2>
                  <p>{text}</p>
                  <span className="muted">
                    <LockKeyhole size={12} />
                    {name === "AI conversations"
                      ? "Available with server configuration"
                      : name === "Real-time voice" ? "Available on supported browsers" : "Not connected · Future milestone"}
                  </span>
                </section>
              ))}
            </div>
          )}
          <footer>
            <span>
              <span className="footer-logo">{BRAND.monogram}</span>
              {BRAND.name} <i /> Designed for a more focused you.
            </span>
            <span>
              <span className="status-dot" />
              LOCAL TASKS <i /> OPT-IN SERVER AI
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
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button,a,select",
                  );
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
                <p>
                  Adjust this session’s visual experience. The brain also
                  respects this setting.
                </p>
                <button
                  className="preference-row"
                  aria-pressed={motion}
                  onClick={() => setMotion(!motion)}
                >
                  {motion ? <Pause size={16} /> : <Play size={16} />}Ambient
                  animations<span>{motion ? "On" : "Paused"}</span>
                </button>
                <VoiceSettings voice={voice} busy={thinking} />
                <small className="muted">
                  Your device’s reduced-motion preference is also respected. Eco
                  and Static views are available above the brain.
                </small>
              </>
            ) : (
              <>
                <p>
                  {BRAND.name} is a local-first personal assistant prototype.
                  Create and prioritise tasks, and use Groq text conversations
                  once your server is configured and explicitly enabled.
                </p>
                <p>
                  Tasks persist in this browser. Conversations and activity last
                  for this session. AI requests send recent messages and task
                  context to Groq under its API data policies. Microphone access
                  starts only on activation. Browser speech may use external
                  vendor services. No paid speech API, email, calendar or Mac
                  controls are enabled.
                </p>
                <div className="shortcut">
                  <kbd>⌘ / Ctrl + K</kbd> Open conversation
                </div>
                <a
                  className="text-button"
                  href={BRAND.repositoryUrl}
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
