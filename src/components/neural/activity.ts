export const NEURAL_MODES = {
  idle: {
    label: "Idle",
    description: "Soft ambient pulses. Ready for your next idea.",
    accent: "blue",
  },
  listening: {
    label: "Listening",
    description:
      "Cyan pulses indicate speech-recognition activity, or a manual visual preview.",
    accent: "blue",
  },
  analyzing: {
    label: "Analyzing",
    description:
      "Sequential clusters illuminate as orange signals trace their connections.",
    accent: "orange",
  },
  task: {
    label: "Task processing",
    description: "Focused clusters light up around a selected objective.",
    accent: "orange",
  },
  retrieval: {
    label: "Knowledge retrieval",
    description: "Blue and orange signals cross between distributed clusters.",
    accent: "orange",
  },
  responding: {
    label: "Responding",
    description:
      "Rhythmic illumination indicates browser speech playback, or a manual visual preview.",
    accent: "blue",
  },
  error: {
    label: "Attention",
    description: "Brief restrained warning for an application or voice error.",
    accent: "orange",
  },
} as const;
export type NeuralMode = keyof typeof NEURAL_MODES;
export const MODE_ORDER = (Object.keys(NEURAL_MODES) as NeuralMode[]).filter(
  (mode) => mode !== "error",
);
export const RENDER_MODE_ORDER: NeuralMode[] = [...MODE_ORDER, "error"];
export const SCENARIOS: {
  command: string;
  mode: NeuralMode;
  variant: number;
  detail: string;
}[] = [
  {
    command: "Plan my schedule",
    mode: "task",
    variant: 0,
    detail: "Planning pattern · surface cluster group A",
  },
  {
    command: "Explain a finance concept",
    mode: "retrieval",
    variant: 1,
    detail: "Retrieval pattern · distributed cross-cluster routing",
  },
  {
    command: "Analyze information",
    mode: "analyzing",
    variant: 2,
    detail: "Analysis pattern · sequential cluster activation",
  },
  {
    command: "Create a task",
    mode: "task",
    variant: 3,
    detail: "Task pattern · surface cluster group D",
  },
  {
    command: "Answer a general question",
    mode: "responding",
    variant: 4,
    detail: "Response pattern · synchronized rhythmic illumination",
  },
];
export function classifyActivity(prompt: string): NeuralMode {
  if (/analy[sz]|compare|information/i.test(prompt)) return "analyzing";
  if (/task|schedule|plan|priorit/i.test(prompt)) return "task";
  if (/explain|finance|knowledge|what|who|why|how|question/i.test(prompt))
    return "retrieval";
  return "analyzing";
}
// Artistic shader envelope only. This is never measured microphone/playback amplitude.
export function simulatedAmplitude(time: number) {
  return Math.max(
    0.08,
    Math.min(
      1,
      0.5 + 0.29 * Math.sin(time * 3.7) + 0.18 * Math.sin(time * 8.3),
    ),
  );
}
