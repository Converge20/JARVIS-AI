// Phase 4 boundary only. No implementation requests microphone permissions or calls a paid API.
export type VoicePhase = "disabled" | "listening" | "transcribing" | "speaking";
export interface VoiceEvents {
  onPhase: (phase: VoicePhase) => void;
  onAmplitude: (value: number) => void; // 0–1 measured microphone/audio output, never synthetic
  onTranscript: (text: string) => void;
}
export interface VoiceTransport {
  pushToTalk(events: VoiceEvents): Promise<void>;
  speak(text: string, preset: VoicePreset, events: VoiceEvents): Promise<void>;
  stop(): void;
}
export interface VoicePreset {
  voice: "onyx" | "echo" | "fable";
  model: "gpt-4o-mini-tts";
  instructions: string;
}
export const VOICE_PRESETS: VoicePreset["voice"][] = ["onyx", "echo", "fable"];
export const BRITISH_VOICE: VoicePreset = {
  model: "gpt-4o-mini-tts",
  voice: "onyx",
  instructions:
    "Use an original masculine synthetic voice with natural British English pronunciation, a calm slightly deep tone, articulate delivery and natural pacing. Never imitate an actor or identifiable person.",
};
export const voiceAvailability = {
  enabled: false,
  message:
    "Voice is prepared for a later phase. Microphone and paid speech APIs are disabled.",
} as const;
