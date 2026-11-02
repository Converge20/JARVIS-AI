import { useEffect, useRef, useState } from "react";
import {
  preferredVoice,
  recognitionConstructor,
  recognitionError,
  speechChunks,
  speechText,
  voiceId,
} from "../services/voice";
import type { BrowserRecognition, VoicePhase } from "../services/voice";
export function useBrowserVoice(callbacks: {
  onTranscript: (text: string) => void;
  onPhase: (phase: VoicePhase) => void;
  onError: () => void;
  canListen?: () => boolean;
}) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const phaseRef = useRef<VoicePhase>("idle");
  const [permission, setPermission] = useState<
    "not-requested" | "requesting" | "granted" | "denied"
  >("not-requested");
  const [error, setError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [rate, setRate] = useState(0.92),
    [pitch, setPitch] = useState(0.9),
    [volume, setVolume] = useState(0.85);
  const options = useRef({ selectedVoice, rate, pitch, volume });
  options.current = { selectedVoice, rate, pitch, volume };
  const recognition = useRef<{
    api: BrowserRecognition;
    sent: boolean;
    finals: Map<number, string>;
    failed: boolean;
  } | null>(null);
  const micTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audioTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const audioLimit = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRevision = useRef(0),
    replyRevision = useRef(0),
    mounted = useRef(true);
  const recognitionAvailable =
    typeof window !== "undefined" &&
    !!recognitionConstructor() &&
    window.isSecureContext !== false;
  const speechAvailable =
    typeof window !== "undefined" &&
    !!window.speechSynthesis &&
    typeof window.SpeechSynthesisUtterance === "function";
  function transition(next: VoicePhase) {
    phaseRef.current = next;
    if (mounted.current) {
      setPhase(next);
      callbacksRef.current.onPhase(next);
    }
  }
  function fail(message: string) {
    if (!mounted.current) return;
    setError(message);
    transition("error");
    callbacksRef.current.onError();
  }
  function refreshVoices() {
    if (!speechAvailable) return;
    let list: SpeechSynthesisVoice[];
    try {
      list = window.speechSynthesis?.getVoices() ?? [];
    } catch {
      list = [];
    }
    voicesRef.current = list;
    if (mounted.current) {
      setVoices(list);
      setSelectedVoice((old) =>
        list.some((v) => voiceId(v) === old)
          ? old
          : preferredVoice(list)
            ? voiceId(preferredVoice(list)!)
            : "",
      );
    }
  }
  function stopSpeaking() {
    ++replyRevision.current;
    ++audioRevision.current;
    clearTimeout(audioTimer.current);
    clearTimeout(audioLimit.current);
    if (utterance.current) {
      utterance.current.onstart = null;
      utterance.current.onend = null;
      utterance.current.onerror = null;
      utterance.current = null;
    }
    if (speechAvailable) window.speechSynthesis?.cancel();
    if (["queued", "speaking"].includes(phaseRef.current)) transition("idle");
  }
  function cancelListening() {
    clearTimeout(micTimer.current);
    const current = recognition.current;
    recognition.current = null;
    if (current && phaseRef.current === "requesting")
      setPermission((previous) =>
        previous === "requesting" ? "not-requested" : previous,
      );
    if (current) {
      current.api.onstart = null;
      current.api.onend = null;
      current.api.onresult = null;
      current.api.onerror = null;
      try {
        current.api.abort();
      } catch {
        /* already stopped */
      }
      transition("idle");
    }
  }
  function stopListening() {
    const current = recognition.current;
    if (!current || phaseRef.current === "transcribing") return;
    if (phaseRef.current === "requesting") {
      cancelListening();
      return;
    }
    transition("transcribing");
    clearTimeout(micTimer.current);
    try {
      current.api.stop();
    } catch {
      cancelListening();
      fail(
        "The microphone could not finish recognition. Please use text input.",
      );
      return;
    }
    micTimer.current = setTimeout(() => {
      if (recognition.current === current) {
        cancelListening();
        fail(
          "Recognition did not finish. No question was sent. Please use text input.",
        );
      }
    }, 3000);
  }
  function startListening() {
    if (recognition.current || callbacksRef.current.canListen?.() === false)
      return;
    if (!recognitionConstructor() || window.isSecureContext === false) {
      fail(
        "Speech recognition is unavailable. Use a supported browser over HTTPS, or type your question.",
      );
      return;
    }
    stopSpeaking();
    setError("");
    setTranscript("");
    setEnabled(true);
    enabledRef.current = true;
    const Constructor = recognitionConstructor()!;
    let api: BrowserRecognition;
    try {
      api = new Constructor();
    } catch {
      fail("Speech recognition is not usable in this browser. Use text input.");
      return;
    }
    const current = {
      api,
      sent: false,
      finals: new Map<number, string>(),
      failed: false,
    };
    recognition.current = current;
    api.continuous = false;
    api.interimResults = true;
    api.lang = "en-GB";
    api.maxAlternatives = 1;
    api.onstart = () => {
      if (recognition.current !== current) return;
      clearTimeout(micTimer.current);
      setPermission("granted");
      transition("listening");
      micTimer.current = setTimeout(stopListening, 20000);
    };
    api.onresult = (event) => {
      if (recognition.current !== current || current.failed) return;
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) current.finals.set(i, result[0].transcript.trim());
        else interim += result[0].transcript + " ";
      }
      setTranscript(
        [...current.finals.values(), interim.trim()]
          .filter(Boolean)
          .join(" ")
          .slice(0, 2200),
      );
    };
    api.onerror = (event) => {
      if (recognition.current !== current) return;
      current.failed = true;
      if (event.error === "not-allowed") setPermission("denied");
      cancelListening();
      fail(recognitionError(event.error));
    };
    api.onend = () => {
      if (recognition.current !== current) return;
      clearTimeout(micTimer.current);
      recognition.current = null;
      const text = [...current.finals.values()].join(" ").trim();
      transition("idle");
      if (!current.failed && !current.sent && text) {
        current.sent = true;
        if (text.length > 2000) {
          fail(
            "The recognised question is too long. Ask a shorter question or use text input.",
          );
          return;
        }
        setTranscript(text);
        callbacksRef.current.onTranscript(text);
      } else if (!current.failed && !current.sent)
        fail(
          "No final speech was recognised. No question was sent. Try again or type your question.",
        );
    };
    setPermission("requesting");
    transition("requesting");
    try {
      micTimer.current = setTimeout(() => {
        if (recognition.current === current) {
          cancelListening();
          fail(
            "Listening did not start. Check microphone permission and browser support, or use text input.",
          );
        }
      }, 15000);
      api.start();
    } catch {
      cancelListening();
      fail(
        "Speech recognition could not start. Check microphone permission, or use text input.",
      );
    }
  }
  function speak(text: string, token = replyRevision.current, preview = false) {
    if (
      token !== replyRevision.current ||
      (!enabledRef.current && !preview) ||
      mutedRef.current
    )
      return false;
    if (document.visibilityState === "hidden") return false;
    if (!speechAvailable) {
      fail(
        "Speech playback is unavailable. Your answer remains in the conversation.",
      );
      return false;
    }
    if (!voicesRef.current.length) {
      fail(
        "The browser has not reported any voices yet. Refresh voices or use text.",
      );
      return false;
    }
    if (recognition.current) return false;
    stopSpeaking();
    setError("");
    const generation = audioRevision.current;
    const chunks = speechChunks(speechText(text));
    if (!chunks.length) return false;
    const settings = options.current;
    const chosen =
      voicesRef.current.find((v) => voiceId(v) === settings.selectedVoice) ??
      preferredVoice(voicesRef.current)!;
    const current = () =>
      mounted.current &&
      generation === audioRevision.current &&
      !mutedRef.current;
    function next(index: number) {
      if (!current()) return;
      if (index === chunks.length) {
        clearTimeout(audioLimit.current);
        utterance.current = null;
        transition("idle");
        return;
      }
      const item = new SpeechSynthesisUtterance(chunks[index]);
      utterance.current = item;
      let ended = false;
      item.voice = chosen;
      item.lang = chosen.lang;
      item.rate = settings.rate;
      item.pitch = settings.pitch;
      item.volume = settings.volume;
      item.onstart = () => {
        if (!current()) return;
        clearTimeout(audioTimer.current);
        transition("speaking");
        audioTimer.current = setTimeout(() => {
          if (current()) {
            stopSpeaking();
            fail(
              "Speech playback stalled. Your answer remains in the conversation.",
            );
          }
        }, 30000);
      };
      item.onend = () => {
        if (!current() || ended) return;
        ended = true;
        clearTimeout(audioTimer.current);
        next(index + 1);
      };
      item.onerror = () => {
        if (!current() || ended) return;
        ended = true;
        stopSpeaking();
        fail(
          "The browser could not play speech. Click Read last reply to retry after allowing audio, or use text.",
        );
      };
      transition(index === 0 ? "queued" : "speaking");
      audioTimer.current = setTimeout(() => {
        if (current()) {
          stopSpeaking();
          fail(
            "Speech did not start. Click Read last reply to allow audio, or use text.",
          );
        }
      }, 8000);
      try {
        window.speechSynthesis.speak(item);
      } catch {
        stopSpeaking();
        fail(
          "Speech playback could not start. Use text or try Read last reply.",
        );
      }
    }
    audioLimit.current = setTimeout(() => {
      if (current()) {
        stopSpeaking();
        fail(
          "Speech time limit reached. The remaining answer is available as text.",
        );
      }
    }, 300000);
    next(0);
    return true;
  }
  function toggleEnabled() {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    if (!next) {
      cancelListening();
      stopSpeaking();
    } else setError("");
  }
  function toggleMute() {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stopSpeaking();
  }
  function changeVoice(value: string) {
    stopSpeaking();
    setSelectedVoice(value);
  }
  function changeNumber(kind: "rate" | "pitch" | "volume", value: number) {
    stopSpeaking();
    if (!Number.isFinite(value)) return;
    if (kind === "rate") setRate(Math.max(0.6, Math.min(1.3, value)));
    if (kind === "pitch") setPitch(Math.max(0.5, Math.min(1.5, value)));
    if (kind === "volume") setVolume(Math.max(0, Math.min(1, value)));
  }
  useEffect(() => {
    mounted.current = true;
    refreshVoices();
    window.speechSynthesis?.addEventListener?.("voiceschanged", refreshVoices);
    const hide = () => {
      if (document.visibilityState === "hidden") {
        cancelListening();
        stopSpeaking();
      }
    };
    const leave = () => {
      cancelListening();
      stopSpeaking();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    return () => {
      mounted.current = false;
      cancelListening();
      stopSpeaking();
      window.speechSynthesis?.removeEventListener?.(
        "voiceschanged",
        refreshVoices,
      );
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
    };
    // Browser API lifecycle: callbacks/settings stay current through refs.
  }, []);
  return {
    phase,
    permission,
    error,
    transcript,
    enabled,
    muted,
    voices,
    selectedVoice,
    rate,
    pitch,
    volume,
    recognitionAvailable,
    speechAvailable,
    refreshVoices,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    toggleEnabled,
    toggleMute,
    changeVoice,
    changeNumber,
    speak,
    replyToken: () => replyRevision.current,
    preview: () =>
      speak(
        "Good evening. I am AXIOM. Your workspace is ready. Shall we make a start?",
        replyRevision.current,
        true,
      ),
  };
}
export type BrowserVoice = ReturnType<typeof useBrowserVoice>;
