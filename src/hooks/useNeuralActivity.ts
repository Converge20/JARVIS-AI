import { useCallback, useEffect, useRef, useState } from "react";
import type { NeuralMode } from "../components/neural/activity";
export function useNeuralActivity() {
  const [activity, setActivity] = useState<{
    mode: NeuralMode;
    variant: number;
  }>({ mode: "idle", variant: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revision = useRef(0);
  const activate = useCallback(
    (mode: NeuralMode, duration = 0, variant = 0) => {
      clearTimeout(timer.current);
      const token = ++revision.current;
      setActivity({ mode, variant });
      if (duration > 0)
        timer.current = setTimeout(() => {
          if (revision.current === token) {
            ++revision.current;
            setActivity({ mode: "idle", variant: 0 });
          }
        }, duration);
      return token;
    },
    [],
  );
  const respond = useCallback(
    (token: number) => {
      // A late response must not interrupt a newer manual state, voice demo, or task action.
      if (revision.current === token) activate("responding", 4200);
    },
    [activate],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const finish = useCallback(
    (token: number, mode: NeuralMode = "idle", duration = 0) => {
      if (revision.current === token) activate(mode, duration);
    },
    [activate],
  );
  return { ...activity, activate, respond, finish };
}
