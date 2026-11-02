import { expect, it } from "vitest";
import { preferredVoice, speechChunks, speechText } from "./voice";
it("prefers an actually reported British male-associated voice without inventing one", () => {
  const voices = [
    {
      name: "Default US",
      lang: "en-US",
      voiceURI: "us",
      localService: true,
      default: true,
    },
    { name: "Serena", lang: "en-GB", voiceURI: "gb", localService: true },
    { name: "Daniel", lang: "en-GB", voiceURI: "dan", localService: true },
  ] as SpeechSynthesisVoice[];
  expect(preferredVoice(voices)?.voiceURI).toBe("dan");
  expect(preferredVoice([])).toBeUndefined();
  expect(preferredVoice(voices.slice(0, 1))?.voiceURI).toBe("us");
});
it("prepares readable bounded speech without Markdown punctuation or executing code", () => {
  const text = speechText(
    "## Heading\n\n**Hello** [world](https://example.org).\n```js\nalert(1)\n```\n| Year | Value |\n| --- | --- |\n| 1 | £105 |",
  );
  expect(text).not.toContain("**");
  expect(text).not.toContain("https:");
  expect(text).not.toContain("alert");
  expect(text).toContain("Code example omitted");
  const chunks = speechChunks(speechText("word ".repeat(2000)));
  expect(chunks.length).toBeGreaterThan(1);
  expect(chunks.every((c) => c.length <= 180)).toBe(true);
  expect(speechText("x".repeat(7000))).toHaveLength(6000);
});
