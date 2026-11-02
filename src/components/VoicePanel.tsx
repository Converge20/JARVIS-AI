import { Mic, AudioLines } from "lucide-react";
import type { BrowserVoice } from "../hooks/useBrowserVoice";
import { voiceId } from "../services/voice";
export function VoiceSettings({
  voice,
  busy = false,
}: {
  voice: BrowserVoice;
  busy?: boolean;
}) {
  const selected = voice.voices.find((v) => voiceId(v) === voice.selectedVoice);
  return (
    <div className="voice-settings">
      <label>
        Speaking voice
        <select
          aria-label="Speaking voice"
          value={voice.selectedVoice}
          onChange={(e) => voice.changeVoice(e.target.value)}
          disabled={!voice.voices.length}
        >
          {!voice.voices.length && (
            <option value="">No voices reported by this browser</option>
          )}
          {voice.voices.map((v) => (
            <option key={voiceId(v)} value={voiceId(v)}>
              {v.name} · {v.lang}
              {v.localService ? " · device" : " · browser network voice"}
            </option>
          ))}
        </select>
      </label>
      <small>
        {selected
          ? `Selected: ${selected.name} (${selected.lang}). ${selected.localService ? "Reported as a local device voice." : "This browser voice may use an external speech service."}`
          : "Waiting for browser-confirmed voices. Refresh the list or use text."}
      </small>
      {!!voice.voices.length &&
        !voice.voices.some((v) => /^en[-_]GB$/i.test(v.lang)) && (
          <small>
            No British English voice is reported. An available voice is selected
            instead.
          </small>
        )}
      <small>
        British English is preferred. Gender is not provided by the browser API;
        preview voices to choose a suitable male character.
      </small>
      {(["rate", "pitch", "volume"] as const).map((kind) => (
        <label key={kind}>
          {kind[0].toUpperCase() + kind.slice(1)}{" "}
          <output>{voice[kind].toFixed(2)}</output>
          <input
            aria-label={`Speech ${kind}`}
            type="range"
            min={kind === "rate" ? 0.6 : kind === "pitch" ? 0.5 : 0}
            max={kind === "rate" ? 1.3 : kind === "pitch" ? 1.5 : 1}
            step="0.01"
            value={voice[kind]}
            onChange={(e) => voice.changeNumber(kind, Number(e.target.value))}
          />
        </label>
      ))}
      <div className="voice-controls">
        <button
          onClick={voice.preview}
          disabled={
            busy ||
            !voice.speechAvailable ||
            !voice.voices.length ||
            voice.muted ||
            ["requesting", "listening", "transcribing"].includes(voice.phase)
          }
        >
          Preview voice
        </button>
        <button onClick={voice.refreshVoices} disabled={!voice.speechAvailable}>
          Refresh voices
        </button>
      </div>
    </div>
  );
}
export function VoicePanel({
  voice,
  processing,
  locked,
  lastReply,
  settings = false,
}: {
  voice: BrowserVoice;
  processing: boolean;
  locked: boolean;
  lastReply: string;
  settings?: boolean;
}) {
  const capturing = ["requesting", "listening", "transcribing"].includes(
    voice.phase,
  );
  const playing = ["queued", "speaking"].includes(voice.phase);
  const label = processing
    ? "Processing your question…"
    : {
        idle: "Ready for a question",
        requesting: "Waiting for microphone permission / browser start…",
        listening: "Listening to one question…",
        transcribing: "Finishing transcription…",
        queued: "Preparing speech…",
        speaking: "Speaking…",
        error: "Voice needs attention",
      }[voice.phase];
  return (
    <section className="panel voice-panel" aria-label="Voice assistant">
      <div className="panel-heading">
        <div className="heading-inline">
          <AudioLines size={17} />
          <h2>Voice assistant</h2>
        </div>
        <span className="demo-tag">BROWSER VOICE</span>
      </div>
      <div
        className={`voice-activity ${capturing || voice.phase === "speaking" ? "active" : ""}`}
        aria-hidden="true"
      >
        <AudioLines size={32} />
      </div>
      <p role="status" aria-label="Voice status">
        {label}
      </p>
      <small>
        Microphone permission (last attempt):{" "}
        {voice.permission.replace("-", " ")}. One question per activation; no
        background listening.
      </small>
      <p className="voice-privacy">
        Browser recognition may send audio to its vendor’s service. Audio is not
        uploaded by AXIOM; recognised text joins the usual Groq conversation and
        task context. Click the microphone only if you agree to that browser
        service.
      </p>
      {!voice.recognitionAvailable && (
        <p className="voice-notice">
          Speech recognition is unavailable here. Use text input; available
          browser voices can still read replies.
        </p>
      )}
      {!voice.speechAvailable && (
        <p className="voice-notice">
          Speech playback is unavailable. Text conversations remain available.
        </p>
      )}
      {voice.error && (
        <p className="voice-error" role="alert">
          {voice.error}
        </p>
      )}
      {!!voice.transcript && (
        <p className="voice-transcript">Heard: {voice.transcript}</p>
      )}
      <div className="voice-controls">
        <button
          className="voice-button"
          onClick={voice.startListening}
          disabled={
            !voice.recognitionAvailable || locked || processing || capturing
          }
        >
          <Mic size={16} />
          Ask by voice
        </button>
        {capturing && (
          <>
            <button onClick={voice.stopListening}>Stop Listening</button>
            <button onClick={voice.cancelListening}>Cancel voice input</button>
          </>
        )}
        <button onClick={voice.stopSpeaking} disabled={!playing}>
          Stop Speaking
        </button>
        <button onClick={voice.toggleMute} aria-pressed={voice.muted}>
          {voice.muted ? "Unmute speech" : "Mute speech"}
        </button>
        <button
          onClick={voice.toggleEnabled}
          disabled={!voice.speechAvailable}
          aria-pressed={voice.enabled}
        >
          {voice.enabled ? "Disable spoken replies" : "Enable spoken replies"}
        </button>
        <button
          onClick={() => voice.speak(lastReply, voice.replyToken(), true)}
          disabled={
            !lastReply ||
            !voice.speechAvailable ||
            !voice.voices.length ||
            voice.muted ||
            capturing ||
            processing
          }
        >
          Read last reply
        </button>
      </div>
      <small>
        Ask by voice enables spoken replies. Indicators follow browser events,
        not measured audio or cognition.
      </small>
      {settings ? (
        <VoiceSettings voice={voice} busy={processing} />
      ) : (
        <details>
          <summary>Voice and speaking settings</summary>
          <VoiceSettings voice={voice} busy={processing} />
        </details>
      )}
    </section>
  );
}
