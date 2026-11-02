import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBrowserVoice } from "./useBrowserVoice";
import { installVoiceMocks } from "../../tests/voice-mocks";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const callbacks = () => ({
  onTranscript: vi.fn(),
  onPhase: vi.fn(),
  onError: vi.fn(),
});
it("does not start a microphone or audio on mount, and discovers only browser-reported voices", () => {
  const mock = installVoiceMocks();
  const { result } = renderHook(() => useBrowserVoice(callbacks()));
  expect(mock.recognizers).toHaveLength(0);
  expect(mock.synth.speak).not.toHaveBeenCalled();
  expect(result.current.selectedVoice).toBe("dan");
  expect(result.current.permission).toBe("not-requested");
  expect(result.current.enabled).toBe(false);
});
it("starts one en-GB non-continuous session, transcribes and submits one final question only after end", () => {
  const mock = installVoiceMocks();
  const cb = callbacks();
  const { result } = renderHook(() => useBrowserVoice(cb));
  act(() => {
    result.current.startListening();
    result.current.startListening();
  });
  expect(mock.recognizers).toHaveLength(1);
  const r = mock.recognizers[0];
  expect(r.continuous).toBe(false);
  expect(r.lang).toBe("en-GB");
  expect(result.current.phase).toBe("requesting");
  act(() => r.onstart?.());
  expect(result.current.phase).toBe("listening");
  act(() => r.result("What is compound interest?", false));
  expect(result.current.transcript).toContain("compound");
  act(() => {
    r.result("What is compound interest?");
    r.result("What is compound interest?");
  });
  expect(cb.onTranscript).not.toHaveBeenCalled();
  const ended = r.onend;
  act(() => {
    ended?.();
    ended?.();
  });
  expect(cb.onTranscript).toHaveBeenCalledExactlyOnceWith(
    "What is compound interest?",
  );
  expect(result.current.phase).toBe("idle");
  expect(result.current.permission).toBe("granted");
});
it("permission denial, network failure and unsupported browsers preserve text fallback", () => {
  const mock = installVoiceMocks();
  const cb = callbacks();
  const { result } = renderHook(() => useBrowserVoice(cb));
  act(() => result.current.startListening());
  act(() => mock.recognizers[0].onerror?.({ error: "not-allowed" }));
  expect(result.current.permission).toBe("denied");
  expect(result.current.error).toContain("permission was denied");
  expect(cb.onTranscript).not.toHaveBeenCalled();
  expect(cb.onError).toHaveBeenCalled();
  act(() => result.current.startListening());
  act(() => mock.recognizers[1].onerror?.({ error: "network" }));
  expect(result.current.error).toContain("external network service");
  vi.stubGlobal("SpeechRecognition", undefined);
  act(() => result.current.startListening());
  expect(result.current.error).toContain("unavailable");
});
it("stops at a bounded listening duration, cancels safely and discards late recognition events", () => {
  vi.useFakeTimers();
  const mock = installVoiceMocks();
  const cb = callbacks();
  const { result, unmount } = renderHook(() => useBrowserVoice(cb));
  act(() => result.current.startListening());
  const r = mock.recognizers[0];
  act(() => r.onstart?.());
  act(() => vi.advanceTimersByTime(20000));
  expect(r.stop).toHaveBeenCalledOnce();
  expect(result.current.phase).toBe("transcribing");
  const lateResult = r.onresult,
    lateEnd = r.onend;
  act(() => result.current.cancelListening());
  expect(r.abort).toHaveBeenCalled();
  act(() => {
    lateResult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "late task" } }],
    });
    lateEnd?.();
  });
  expect(cb.onTranscript).not.toHaveBeenCalled();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("speech follows real start/end events, uses selected settings, and ignores stale cancellation callbacks", () => {
  const mock = installVoiceMocks();
  const cb = callbacks();
  const { result } = renderHook(() => useBrowserVoice(cb));
  act(() => {
    result.current.toggleEnabled();
    result.current.changeNumber("rate", 0.8);
  });
  act(() => result.current.speak("A concise answer."));
  const u = mock.utterances[0];
  expect(u.voice?.name).toBe("Daniel");
  expect(u.rate).toBe(0.8);
  expect(u.pitch).toBe(0.9);
  expect(result.current.phase).toBe("queued");
  act(() => u.onstart?.(new Event("start") as SpeechSynthesisEvent));
  expect(result.current.phase).toBe("speaking");
  const late = u.onend;
  act(() => result.current.stopSpeaking());
  act(() => late?.call(u, new Event("end") as SpeechSynthesisEvent));
  expect(result.current.phase).toBe("idle");
  expect(mock.synth.cancel).toHaveBeenCalled();
});
it("mute/disable invalidates pending reply audio, and selecting a voice never invents availability", () => {
  const mock = installVoiceMocks();
  const { result } = renderHook(() => useBrowserVoice(callbacks()));
  act(() => result.current.toggleEnabled());
  const token = result.current.replyToken();
  act(() => result.current.toggleMute());
  act(() => result.current.toggleMute());
  act(() => result.current.speak("Late answer", token));
  expect(mock.synth.speak).not.toHaveBeenCalled();
  act(() => result.current.changeVoice("sam"));
  act(() => result.current.preview());
  expect(mock.utterances[0].voice?.name).toBe("Samantha");
  act(() => result.current.toggleEnabled());
  expect(result.current.enabled).toBe(false);
  expect(result.current.phase).toBe("idle");
  mock.synth.getVoices.mockReturnValue([]);
  act(() => result.current.refreshVoices());
  act(() => result.current.preview());
  expect(result.current.error).toContain("not reported any voices");
});
it("dynamic voiceschanged updates the list, hidden tabs and unmount cancel voice activity", () => {
  const mock = installVoiceMocks();
  const { result, unmount } = renderHook(() => useBrowserVoice(callbacks()));
  mock.synth.getVoices.mockReturnValue([]);
  act(() => mock.events.dispatchEvent(new Event("voiceschanged")));
  expect(result.current.voices).toEqual([]);
  act(() => result.current.startListening());
  const r = mock.recognizers[0];
  act(() => r.onstart?.());
  const hidden = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(r.abort).toHaveBeenCalled();
  expect(result.current.phase).toBe("idle");
  hidden.mockRestore();
  unmount();
  expect(mock.synth.cancel).toHaveBeenCalled();
});
it("autoplay failures and no-speech outcomes are visible, not simulated playback", () => {
  const mock = installVoiceMocks();
  const { result } = renderHook(() => useBrowserVoice(callbacks()));
  act(() => result.current.preview());
  const u = mock.utterances[0];
  act(() => u.onerror?.(new Event("error") as SpeechSynthesisErrorEvent));
  expect(result.current.error).toContain("Read last reply");
  expect(result.current.phase).toBe("error");
  act(() => result.current.startListening());
  act(() => mock.recognizers[0].onend?.());
  expect(result.current.error).toContain("No final speech");
});
it("refuses microphone activation while an application request or task confirmation locks input", () => {
  const mock = installVoiceMocks();
  const cb = { ...callbacks(), canListen: () => false };
  const { result } = renderHook(() => useBrowserVoice(cb));
  act(() => result.current.startListening());
  expect(mock.recognizers).toHaveLength(0);
  expect(result.current.permission).toBe("not-requested");
});
