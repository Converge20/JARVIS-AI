export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
}
export interface BrowserRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => BrowserRecognition;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  const candidate =
    browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  return typeof candidate === "function" ? candidate : undefined;
}
export type VoicePhase =
  | "idle"
  | "requesting"
  | "listening"
  | "transcribing"
  | "queued"
  | "speaking"
  | "error";
export const voiceId = (voice: SpeechSynthesisVoice) =>
  voice.voiceURI || `${voice.name}|${voice.lang}`;
export function preferredVoice(voices: SpeechSynthesisVoice[]) {
  // Gender is NOT part of the API. These names are only a preference heuristic.
  const score = (v: SpeechSynthesisVoice) =>
    (/^en[-_]GB$/i.test(v.lang) ? 100 : /^en\b/i.test(v.lang) ? 40 : 0) +
    (/\b(daniel|george|arthur|oliver|ryan|thomas|male)\b/i.test(v.name) &&
    !/female/i.test(v.name)
      ? 20
      : 0) +
    (v.localService ? 5 : 0) +
    (v.default ? 1 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}
export function speechText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " Code example omitted from speech. ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/^[ \t]{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+)/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\|/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}
export function speechChunks(text: string) {
  return (
    text
      .match(/.{1,180}(?:\s|$)|\S{1,180}/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}
export const recognitionError = (code: string) =>
  ({
    "not-allowed":
      "Microphone permission was denied or speech recognition is blocked. Allow microphone access for this private preview, or type your question.",
    "service-not-allowed":
      "The browser speech service is unavailable or blocked. Use text input.",
    "audio-capture":
      "No usable microphone was found. Check your browser and device input settings.",
    "no-speech":
      "No speech was detected. Click the microphone to try again, or type your question.",
    network:
      "The browser speech-recognition service could not connect. It may require an external network service. Text input still works.",
    "language-not-supported":
      "British English recognition is unavailable in this browser. Use text input.",
  })[code] ??
  "Speech recognition failed. Please try a short question or use text input.";
