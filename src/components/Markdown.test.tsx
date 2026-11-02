import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";
it("renders headings, bold, lists, code and GFM tables as semantic elements", () => {
  const { container } = render(
    <Markdown
      content={
        "## Finance\n\n**Compound interest**\n\n- First\n- Second\n\n`balance`\n\n```js\nconst total = 1;\n```\n\n| Year | Value |\n| --- | --- |\n| 1 | £105 |"
      }
    />,
  );
  expect(screen.getByRole("heading", { name: "Finance" })).toBeInTheDocument();
  expect(container.querySelector("strong")).toHaveTextContent(
    "Compound interest",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByRole("table")).toHaveTextContent("£105");
  expect(container.querySelector("pre code")).toHaveTextContent("const total");
});
it("drops unsafe HTML, scripts, tracking images and unsafe link protocols", () => {
  const { container } = render(
    <Markdown
      content={
        '<script>alert(1)</script>\n\n<img src="https://tracker.invalid/pixel" onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n[data](data:text/html,test)\n\n![tracking](https://tracker.invalid/pixel)\n\n[safe](https://example.org)'
      }
    />,
  );
  expect(container.querySelector("script,img,iframe")).toBeNull();
  expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "data" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
});
