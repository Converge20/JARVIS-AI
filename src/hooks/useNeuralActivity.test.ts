import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useNeuralActivity } from "./useNeuralActivity";
afterEach(() => vi.useRealTimers());
it("returns timed demonstrations to idle and cancels superseded timers", () => {
  vi.useFakeTimers();
  const { result } = renderHook(useNeuralActivity);
  act(() => {
    result.current.activate("listening", 8000);
  });
  expect(result.current.mode).toBe("listening");
  act(() => {
    vi.advanceTimersByTime(4000);
    result.current.activate("task", 3500, 3);
  });
  act(() => {
    vi.advanceTimersByTime(3499);
  });
  expect(result.current.mode).toBe("task");
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(result.current.mode).toBe("idle");
});
it("prevents a late simulated reply from overriding a newer manual state", () => {
  const { result } = renderHook(useNeuralActivity);
  let token = 0;
  act(() => {
    token = result.current.activate("analyzing");
  });
  act(() => {
    result.current.activate("listening");
    result.current.respond(token);
  });
  expect(result.current.mode).toBe("listening");
});
it("transitions a current conversation to responding and clears timers on unmount", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useNeuralActivity);
  let token = 0;
  act(() => {
    token = result.current.activate("retrieval");
  });
  act(() => result.current.respond(token));
  expect(result.current.mode).toBe("responding");
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("returns a restrained error indication to idle", () => {
  vi.useFakeTimers();
  const { result } = renderHook(useNeuralActivity);
  act(() => result.current.activate("error", 2200));
  expect(result.current.mode).toBe("error");
  act(() => vi.advanceTimersByTime(2200));
  expect(result.current.mode).toBe("idle");
});
