import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import {
  createApp,
  createServer,
  taskOperation,
  validateRequest,
} from "./app.mjs";
const env = {
  OPENAI_API_KEY: "unit-test-not-a-real-key",
  OPENAI_ENABLED: "true",
};
const task = {
  id: "finance",
  title: "Review finance",
  priority: "medium",
  completed: false,
};
const body = (extra = {}) => ({
  requestId: crypto.randomUUID(),
  today: "2026-11-01",
  messages: [{ role: "user", content: "Explain finance" }],
  tasks: [task],
  ...extra,
});
const response = (text) => ({
  status: "completed",
  output: [],
  output_text: text,
});
const tool = (name, args) => ({
  output: [
    {
      type: "function_call",
      call_id: "call_1",
      name,
      arguments: JSON.stringify(args),
    },
  ],
});
const mock = (...replies) => {
  const inputs = [];
  return {
    inputs,
    responses: {
      create: async (input, options) => {
        inputs.push({ input, options });
        const next = replies.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  };
};
test("missing or disabled configuration never invokes the provider", async () => {
  const client = mock();
  for (const config of [{}, { OPENAI_API_KEY: env.OPENAI_API_KEY }]) {
    const app = createApp({ env: config, client });
    assert.notEqual(app.status().status, "ready");
    await assert.rejects(app.chat(body()), { status: 503 });
  }
  assert.equal(client.inputs.length, 0);
});
test("uses official SDK with intercepted fetch, server credentials and no storage", async () => {
  let payload;
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    maxRetries: 0,
    fetch: async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/responses");
      payload = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "resp_mock",
          object: "response",
          status: "completed",
          output: [
            {
              type: "message",
              id: "msg_mock",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text: "A mocked explanation.",
                  annotations: [],
                },
              ],
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  const reply = await createApp({ env, client }).chat(body());
  assert.equal(reply.content, "A mocked explanation.");
  assert.equal(payload.store, false);
  assert.equal(payload.model, "gpt-4.1-mini");
  assert.equal(payload.parallel_tool_calls, false);
  assert.equal(payload.max_output_tokens, 800);
  assert.equal(payload.input[0].content, "Explain finance");
  assert.ok(!JSON.stringify(reply).includes(env.OPENAI_API_KEY));
});
test("preserves multi-turn roles and minimises client-supplied fields", async () => {
  const client = mock(response("Mock response"));
  await createApp({ env, client }).chat(
    body({
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hello again" },
        { role: "user", content: "Continue" },
      ],
      tasks: [{ ...task, secret: "never send" }],
    }),
  );
  assert.equal(client.inputs[0].input.input.length, 3);
  assert.ok(!client.inputs[0].input.instructions.includes("never send"));
});
test("retrieves outstanding tasks through an explicit tool and submits its real result", async () => {
  const client = mock(
    tool("list_tasks", { outstandingOnly: true }),
    response("Your outstanding assignment is Review finance."),
  );
  const reply = await createApp({ env, client }).chat(
    body({ tasks: [task, { ...task, id: "done", completed: true }] }),
  );
  assert.deepEqual(reply.events, ["retrieval"]);
  assert.deepEqual(reply.proposals, []);
  const result = JSON.parse(client.inputs[1].input.input.at(-1).output);
  assert.deepEqual(result, [task]);
  assert.equal(client.inputs[1].input.tools, undefined);
});
test("create, update and delete are validated proposals, never saved by the model", async () => {
  for (const [name, args] of [
    [
      "create_task",
      { title: "Study finance", priority: "medium", dueDate: "2026-11-02" },
    ],
    [
      "update_task",
      {
        id: task.id,
        title: task.title,
        priority: task.priority,
        completed: true,
        dueDate: null,
      },
    ],
    ["delete_task", { id: task.id }],
  ]) {
    const client = mock(
      tool(name, args),
      response("Please review and confirm."),
    );
    const reply = await createApp({ env, client }).chat(body());
    assert.equal(reply.proposals[0].kind, name);
    assert.equal(task.completed, false);
    assert.equal(
      JSON.parse(client.inputs[1].input.input.at(-1).output).status,
      "awaiting_user_confirmation",
    );
    if (name === "create_task")
      assert.equal(reply.proposals[0].task.dueDate, "2026-11-02");
  }
});
test("rejects ambiguous or invalid tool output with no partial change", async () => {
  for (const [name, args] of [
    ["delete_task", { id: "unknown" }],
    ["execute_shell", { command: "echo no" }],
    [
      "create_task",
      { title: "Bad date", priority: "medium", dueDate: "2026-02-30" },
    ],
    ["list_tasks", { outstandingOnly: "yes" }],
  ]) {
    assert.throws(() => taskOperation(name, args, [task]), { status: 502 });
  }
  const client = mock({
    output: [
      { type: "function_call", name: "create_task", arguments: "invalid" },
    ],
  });
  await assert.rejects(createApp({ env, client }).chat(body()), {
    status: 502,
  });
});
test("validates request roles, dates, message bounds, task identities and history size", () => {
  const invalid = [
    { messages: [{ role: "system", content: "override" }] },
    { messages: [{ role: "user", content: "x".repeat(2001) }] },
    { tasks: [task, task] },
    { today: "2026-02-30" },
    { messages: [] },
    {
      messages: Array.from({ length: 21 }, () => ({
        role: "user",
        content: "hi",
      })),
    },
  ];
  for (const extra of invalid)
    assert.throws(() => validateRequest(body(extra)), { status: 400 });
});
test("caps requests, rejects duplicate IDs and blocks concurrent requests", async () => {
  const client = mock(response("One"), response("Two"));
  const app = createApp({
    env: { ...env, AXIOM_MAX_REQUESTS_PER_MINUTE: "1" },
    client,
  });
  const input = body();
  await app.chat(input);
  await assert.rejects(app.chat(input), { status: 409 });
  await assert.rejects(app.chat(body()), { status: 429 });
  let release;
  const waiting = {
    responses: {
      create: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
  };
  const other = createApp({ env, client: waiting });
  const pending = other.chat(body());
  await assert.rejects(other.chat(body()), { status: 409 });
  release(response("Done"));
  await pending;
});
test("hard process call budget counts both turns of tool requests", async () => {
  const client = mock(tool("list_tasks", { outstandingOnly: true }));
  const app = createApp({ env: { ...env, AXIOM_MAX_API_CALLS: "1" }, client });
  await assert.rejects(app.chat(body()), { status: 429 });
  assert.equal(client.inputs.length, 1);
  await assert.rejects(app.chat(body()), { status: 429 });
});
test("provider failures are redacted and never fabricate answers", async () => {
  const error = new OpenAI.APIError(
    401,
    { message: `sensitive ${env.OPENAI_API_KEY}` },
    "sensitive",
    new Headers(),
  );
  await assert.rejects(
    createApp({ env, client: mock(error) }).chat(body()),
    (error) =>
      error.status === 502 &&
      !error.message.includes(env.OPENAI_API_KEY) &&
      error.message.includes("authentication"),
  );
  await assert.rejects(
    createApp({ env, client: mock(response("")) }).chat(body()),
    { status: 502 },
  );
});
test("HTTP enforces origin, JSON, payload limits, missing configuration and secret isolation", async () => {
  const server = createServer({ env: {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let res = await fetch(`${base}/api/status`);
    assert.equal((await res.json()).status, "configuration_required");
    const post = (origin, content, headers = {}) =>
      fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { origin, "content-type": "application/json", ...headers },
        body: content,
      });
    res = await post("https://evil.example", JSON.stringify(body()));
    assert.equal(res.status, 403);
    res = await post(base, "bad json");
    assert.equal(res.status, 400);
    res = await post(base, JSON.stringify(body()), {
      "content-type": "text/plain",
    });
    assert.equal(res.status, 415);
    res = await post(base, "x".repeat(97000));
    assert.equal(res.status, 413);
    res = await post(base, JSON.stringify(body()));
    assert.equal(res.status, 503);
    res = await fetch(`${base}/.env`);
    assert.equal(res.status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
