import { vi } from "vitest";
import type {
  BrowserRecognition,
  RecognitionResultEvent,
} from "../src/services/voice";
export function installVoiceMocks() {
  const recognizers: FakeRecognition[] = [];
  class FakeRecognition implements BrowserRecognition {
    continuous = true;
    interimResults = false;
    lang = "";
    maxAlternatives = 0;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onresult: ((event: RecognitionResultEvent) => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      recognizers.push(this);
    }
    result(text: string, isFinal = true) {
      this.onresult?.({
        resultIndex: 0,
        results: [{ isFinal, 0: { transcript: text } }],
      });
    }
  }
  const utterances: SpeechSynthesisUtterance[] = [];
  class FakeUtterance {
    text: string;
    voice: SpeechSynthesisVoice | null = null;
    lang = "";
    rate = 1;
    pitch = 1;
    volume = 1;
    onstart: ((event?: unknown) => void) | null = null;
    onend: ((event?: unknown) => void) | null = null;
    onerror: ((event?: unknown) => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const voices = [
    {
      name: "Samantha",
      lang: "en-US",
      voiceURI: "sam",
      localService: true,
      default: true,
    },
    {
      name: "Daniel",
      lang: "en-GB",
      voiceURI: "dan",
      localService: true,
      default: false,
    },
  ] as SpeechSynthesisVoice[];
  const events = new EventTarget();
  const synth = {
    getVoices: vi.fn(() => voices),
    speak: vi.fn((u: SpeechSynthesisUtterance) => utterances.push(u)),
    cancel: vi.fn(),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("webkitSpeechRecognition", undefined);
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  return { recognizers, utterances, voices, synth, events };
}
