# Phase 4 — British browser voice and safe Markdown

AXIOM's existing Groq conversation and confirmed task tools now accept one spoken question at a time and can read replies with browser SpeechSynthesis. No paid speech service, account, API key, audio file or actor-cloning asset is introduced. A refined British character comes from the existing British English assistant instructions, a measured speaking rate and lower pitch, plus the **actual available browser voice you select**. It is not an imitation or clone of any actor.

## Update your existing GitHub Codespace

In the Codespaces **browser terminal**, stop the current server with **Control+C**, then run:

```bash
git switch feat/axiom-neural-interface
git pull --ff-only origin feat/axiom-neural-interface
npm ci
export GROQ_ENABLED=true
export AXIOM_ALLOWED_ORIGIN=""
npm run dev -- --port 5173 --strictPort
```

The empty origin override discards an old manual setting; the exact private Codespaces origin is derived automatically. Your existing `GROQ_API_KEY` Codespaces secret stays server-side. No extra voice key is required. If that secret was added since the Codespace started, stop and reopen the same Codespace to refresh its environment, then start a new terminal.

In **Ports**, keep **5173 Private** and select **Open in Browser**. Open the app in its own browser tab; an embedded editor preview may restrict microphone access. Do not forward backend port 3001 separately. No installation on your Mac is needed.

## First voice conversation

1. Use a supported browser, preferably current desktop Chrome on macOS. The private forwarded preview is HTTPS. If recognition is unavailable, a clear text fallback is shown; browser speech output can still work independently.
2. In **Voice assistant → Voice and speaking settings**, select a voice from the confirmed list. Click **Refresh voices** if the browser has not populated it yet. Select an `en-GB` voice that you like and click **Preview voice**. Voice settings are also available in Preferences.
3. Adjust **Rate**, **Pitch** and **Volume** if needed. Defaults are rate 0.92, pitch 0.90 and volume 0.85. Settings are session-only. Changing them stops current/pending playback; preview or Read last reply to apply them.
4. Read the privacy notice, then click **Ask by voice**. This is the first point at which recognition starts and the browser may request microphone permission. Allow access for the private preview if you consent to the browser's recognition service.
5. Say, for example, **“Explain compound interest in simple terms.”** The transcript appears in the voice panel and conversation. Recognition ends after the question; **Stop Listening** can finish it sooner. A final transcript is sent once, only after recognition ends.
6. The brain shows Analyzing while Groq processes the text. A successful answer renders as safe Markdown and is read by the selected browser voice. Speaking activity follows actual synthesis start/end events; the interface returns to Idle afterward.
7. If the browser blocks asynchronous speech, click **Read last reply**, which supplies a fresh user gesture. The text answer is always available.

**Ask by voice** enables spoken replies for the session. You can also select **Enable spoken replies** to read typed conversations without using a microphone. Preview voice and Read last reply are explicit one-off playback actions and do not enable automatic future replies.

Controls:

- **Stop Listening:** stop capture and finish the current question. If the browser produces no final transcript, nothing is sent.
- **Cancel voice input:** abort and discard the current question, including late recognition callbacks.
- **Stop Speaking:** immediately cancel the current utterance and remaining chunks.
- **Mute speech / Unmute speech:** suppress output; muting also invalidates pending auto-play from an in-flight AI reply. Muting does not mute the microphone—use Stop Listening or Cancel voice input for that.
- **Disable spoken replies:** turn off automatic output and stop current voice activity. A response that was pending before cancellation cannot unexpectedly resume speech after re-enabling.

Changing app navigation stops microphone input and speech, including pending reply playback. Hiding the browser tab, leaving the page, disabling voice or unmounting the app cancels input and output. There is no wake word, continuous listening or automatic microphone restart. Recognition uses `continuous=false`, one language (`en-GB`), a 20-second listening cap, and bounded start/finalisation timeouts. The permission indicator describes the last attempt, not an independent continuous permission monitor.

## Privacy, security and costs

The Web Speech API is a browser facility, not a guarantee of local processing. In Chrome, recognition may send microphone audio to a vendor-hosted service and may need network connectivity. AXIOM itself does not use MediaRecorder/getUserMedia, upload audio to its server, send audio to Groq or save audio. Recognised text becomes ordinary session conversation and is sent with the usual recent chat/task context through the existing secure Groq backend. If you do not want browser-vendor recognition, use text input.

SpeechSynthesis voices may be local or network-backed. The UI reports the voice's `localService` value rather than promising offline synthesis. A browser/network voice may send answer text to that provider. Selecting a reported device voice can reduce that dependency, but check your browser/OS policies if strict offline processing is required. No paid speech API, subscription, actor clone, billing activation or additional account is used by AXIOM.

Voice support varies by browser and OS. `getVoices()` and `voiceschanged` populate the list dynamically; the app never claims that Daniel, a British voice, or a male voice exists before it is reported. There is **no standard voice gender field**. The default ranking prefers British English, then common male-associated names such as Daniel or George, then local/default voices. That is only a heuristic. Preview and choose for yourself. If no British voice is reported, the UI says so and selects an available alternative; no software or voice is installed automatically.

The only capability-header change is `microphone=(self)` instead of denying every microphone use, with `camera=()` still denied. This permits microphone use for the app's own origin after explicit activation and browser permission. The strict exact-origin checks, private-port guidance, lack of broad CORS, server-only Groq key, request validation, limits and task confirmations are preserved. Voice cannot confirm or delete tasks automatically: proposed mutations still require the existing explicit confirmation controls.

The browser and OS control permission prompts, transcription accuracy, vendor availability, autoplay and vocal quality. No guarantee of a particular accent, gender or naturalness can be made on a headless development runner. Groq Free Plan limits remain unchanged; voice input uses the same text request quota. No provider inference is called by voice discovery, preview, microphone recognition alone, or Check connection. Only submitting a final question invokes Groq.

Official references:

- [SpeechRecognition support and server-based recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Browser voice discovery](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)
- [Voice metadata, including language and local service](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice)

## Implementation and limits

`src/hooks/useBrowserVoice.ts` owns recognition/synthesis sessions, cancellation tokens, timeouts, mute, settings and voice discovery. Final recognition events are deduplicated; input is locked during AI requests or pending task confirmations. Output is cancelled before listening to prevent transcribing the assistant's own voice. Long replies use bounded, word-separated utterance chunks rather than one fragile long utterance. Speech strips Markdown punctuation, omits fenced code and is capped at 6,000 characters / five minutes; full content remains visible. A stalled utterance fails visibly rather than pretending to speak.

The anatomical model, geometry, licensed assets and rendering performance controls are preserved. Real Listening and Speaking states follow browser events, Processing follows the Groq request, and a brief low-intensity amber Attention state indicates errors. The six manual visual previews remain available; the warning state is application-only. Pulses are artistic event indicators, **not measured microphone amplitude, an audio waveform or AI cognition**. SpeechSynthesis exposes no audio waveform to this implementation. Reduced-motion preferences and Ambient animations pause these visual loops without disabling speech.

`react-markdown`, `remark-gfm` and `rehype-sanitize` render headings, lists, strong text, inline/fenced code and GFM tables. There is no raw-HTML parser: raw HTML is skipped, the output AST is sanitized, unsafe URL schemes are rejected, and images are removed to avoid tracking requests. External links require an explicit click and use `noopener noreferrer`. User messages remain plain escaped text. Code is displayed, never evaluated; tasks are still changed only through explicit application functions. The added parser dependencies increase the main browser bundle; the existing lazy Three.js renderer is unchanged apart from the restrained warning shader/state.

## Validation

Automated voice tests use fake browser recognition/synthesis objects and explicit events, never a real microphone or vendor speech connection. Groq responses remain mocked and browser test servers clear the key and disable Groq. Tests cover default inactivity, discovered voice preference, unsupported APIs, one-shot recognition, permission/network/no-speech errors, cancellation and late events, time limits, mute, settings/preview, hidden-tab cleanup, the full question/reply/playback cycle, and Markdown formatting/XSS protection. Existing proxy, origin, backend, task and anatomy tests remain in place.

```bash
npm audit
npm audit --omit=dev
npm test
npm run build
npm run test:e2e
```

Actual macOS microphone consent, live transcription, system-voice availability/quality and asynchronous audio playback still require a manual test in your private Codespace preview. The current development environment does not access the user's microphone or Groq secret. No live paid inference, public deployment or merge is performed. GitHub CI's previously reported orange-pixel timeout remains separate and is reported if repeated; no visual check is weakened to claim success.

## Review evidence

- `npm test`: **77 passed** — 50 React/service/anatomy tests plus 27 Node backend/origin/proxy/policy tests.
- Full local Chromium suite: **17 passed**, including four new mocked browser voice scenarios and every existing dashboard, task, connection and anatomical rendering workflow.
- `npm run build`: passed; the existing lazy Three.js chunk-size advisory remains. Main JavaScript is about 144 KB gzip after the Markdown/voice additions; lazy rendering remains about 258 KB gzip.
- Full and production-only `npm audit`: **0 vulnerabilities**.
- `git diff --check` and browser-bundle provider-endpoint/test-credential checks: passed.
- No actual microphone, system audio or live provider inference was used by automated tests. macOS voice quality and permissions require the beginner test steps above. GitHub Actions results for the pushed commit are recorded in Draft PR #2 separately.
