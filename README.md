# JARVIS-AI

**Personal intelligence. A focused workspace.**

JARVIS-AI is an original, futuristic personal assistant prototype built with React, TypeScript, and Vite. The first milestone brings a cinematic command center together with practical, local task management. It requires no API keys, account, backend, or paid services.

## Current capabilities

- **Command center:** animated holographic core, rotating rings, subtle particles, responsive glass-like panels, live local clock, and task summaries.
- **Tasks:** add, edit, complete, reopen, delete, and prioritize objectives. Filter all, pending, or completed tasks. Tasks persist after refresh using browser local storage. First launch includes editable onboarding tasks.
- **Conversation:** session history, user and assistant messages, typing indicator, and suggested prompts. Scripted responses can summarize your actual pending tasks, report the current date/time, and explain the prototype.
- **Voice demonstration:** microphone button, animated waveform, and a listening simulation that stops automatically after eight seconds. **No microphone is accessed and no audio is recorded.**
- **System overview:** actual workspace state, storage availability, and an activity log of interface events. No fabricated CPU, memory, network, or other computer measurements.
- **Usability:** keyboard-accessible controls and dialogs, reduced-motion support, a session animation toggle, and `⌘/Ctrl + K` to open conversation.

**All assistant replies are scripted demonstrations, not real AI.** The interface labels this throughout. Calendar, email, real voice, Mac controls, weather, and personal memory are planned, disconnected capabilities.

## Run locally

Prerequisite: Node.js 22.12+ or Node.js 24 LTS, with npm. These commands install project dependencies only; they do not require administrator privileges or system-wide software installation.

```bash
git clone https://github.com/Converge20/JARVIS-AI.git
cd JARVIS-AI
# Before merge, check out the prototype branch:
git checkout feat/jarvis-command-center
npm ci
npm run dev
```

Open **http://localhost:5173**. The Vite script binds to `0.0.0.0` for cloud-workspace previews; to restrict a personal preview to your machine, use `npm run dev -- --host 127.0.0.1`.

```bash
npm run build       # TypeScript checking + production bundle in dist/
npm run preview     # Preview that production bundle at http://localhost:4173
npm test            # Automated service and React interaction tests
npm run test:e2e    # Chromium browser workflows
```

For the browser tests, install Playwright's Chromium into your development environment with `npx playwright install chromium`. Where a Chromium binary is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium` instead. This is only a development/test dependency and is never required by app users. CI installs browser dependencies on an ephemeral Ubuntu runner.

## Architecture

```text
src/
  App.tsx                  Navigation, session state, activity, dashboard
  components/
    Core.tsx               CSS-based holographic core and waveform
    Chat.tsx               Conversation history and composer
    Tasks.tsx              Task filters, editor and actions
  hooks/useTasks.ts        Persistence lifecycle and storage error handling
  services/
    assistant.ts           AssistantProvider contract and scripted provider
    tasks.ts               Versioned task storage and validation
  types.ts                 Shared domain types
  styles.css               Responsive visual system and reduced-motion rules
  main.tsx                 React entry point
public/favicon.svg         Original project mark
tests/                     Browser workflows and test setup
.github/workflows/ci.yml   Tests and production build on pull requests
```

Runtime dependencies are React, React DOM, and Lucide icons. Animations use CSS; there is no animation library, external font, analytics script, or remote asset dependency.

`AssistantProvider.reply(prompt, context)` is the boundary for future conversation providers. A real AI integration must call a protected backend that owns credentials, authentication, rate limits, and context policies. Do not place credentials in frontend code or `VITE_*` variables: those values are public in a browser bundle. Future tool integrations should use separate, scoped adapters and explicit user approval for sensitive actions.

## Data and security

- Task data is stored under `jarvis.tasks.v1` on the current browser origin. It is not encrypted and is not synced. Avoid storing secrets or highly sensitive data. Clearing browser site data deletes saved tasks.
- Conversation and activity are held in memory and reset on reload. Preferences apply to the current session.
- Invalid saved data is preserved; the interface warns you and requires an explicit choice before replacing it. If storage is blocked or full, changes remain usable in the session and a visible warning explains that they are not persisted.
- There are no AI API calls, microphone permissions, paid integrations, device automation, or telemetry. The application works without an external connection once its assets have loaded.
- `.gitignore` excludes environment files, dependencies, generated builds, and browser test artifacts. No credentials are needed for this milestone.
- There is no deployment workflow. Changes are intended for review on a feature branch before any merge into `main`.

## Roadmap

1. Server-backed AI conversations with the professional, calm, concise assistant persona.
2. Permission-based real-time voice interaction.
3. Calendar, email, reminders, weather, and productivity adapters.
4. Approved Mac application actions with explicit confirmation and narrow permissions.
5. User preferences and optional, user-controlled memory.

Future integrations must document their data handling and permissions before activation. This project uses original dialogue and visuals; it does not reproduce movie dialogue or an actor's voice.

## Validation

Vitest and React Testing Library cover storage validation, scripted responses, task creation/editing/completion/deletion/persistence, chat history, voice simulation, and animation preferences. Playwright covers actual browser reload persistence, navigation, responsive overflow checks, and preservation of damaged saved data. The pull request records the exact results for this milestone.
