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
  GROQ_API_KEY: "unit-test-not-a-real-key",
  GROQ_ENABLED: "true",
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
  for (const config of [{}, { GROQ_API_KEY: env.GROQ_API_KEY }]) {
    const app = createApp({ env: config, client });
    assert.notEqual(app.status().status, "ready");
    await assert.rejects(app.chat(body()), { status: 503 });
  }
  assert.equal(client.inputs.length, 0);
});
test("uses the existing SDK against Groq only, without unsupported storage fields", async () => {
  let payload;
  const providerFetch = async (url, init) => {
    assert.equal(String(url), "https://api.groq.com/openai/v1/responses");
    assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${env.GROQ_API_KEY}`);
    assert.ok(!init.body.includes(env.GROQ_API_KEY));
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
  };
  const reply = await createApp({ env, fetch: providerFetch }).chat(body());
  assert.equal(reply.content, "A mocked explanation.");
  assert.equal(payload.store, undefined);
  assert.deepEqual(payload.reasoning, { effort: "low" });
  assert.equal(reply.provider, "groq");
  assert.equal(payload.model, "openai/gpt-oss-20b");
  assert.equal(payload.parallel_tool_calls, false);
  assert.equal(payload.max_output_tokens, 1024);
  assert.equal(payload.input[0].content, "Explain finance");
  assert.ok(!JSON.stringify(reply).includes(env.GROQ_API_KEY));
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
    { message: `sensitive ${env.GROQ_API_KEY}` },
    "sensitive",
    new Headers(),
  );
  await assert.rejects(
    createApp({ env, client: mock(error) }).chat(body()),
    (error) =>
      error.status === 502 &&
      !error.message.includes(env.GROQ_API_KEY) &&
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
test("old OpenAI configuration never enables a request or becomes a fallback credential", async () => {
  const client = mock();
  const app = createApp({
    env: {
      OPENAI_API_KEY: "unused-test-placeholder",
      OPENAI_ENABLED: "true",
      GROQ_ENABLED: "true",
    },
    client,
  });
  assert.equal(app.status().status, "configuration_required");
  assert.match(app.status().message, /GROQ_API_KEY/);
  await assert.rejects(app.chat(body()), { status: 503 });
  assert.equal(client.inputs.length, 0);
});
test("model is configurable and reasoning options are limited to the supported GPT OSS family", async () => {
  const client = mock(response("Mock answer"));
  await createApp({
    env: { ...env, GROQ_MODEL: "custom-tool-capable-model" },
    client,
  }).chat(body());
  assert.equal(client.inputs[0].input.model, "custom-tool-capable-model");
  assert.equal(client.inputs[0].input.reasoning, undefined);
});
test("oversized provider input is rejected before any upstream call", async () => {
  const client = mock();
  await assert.rejects(
    createApp({ env: { ...env, AXIOM_MAX_INPUT_BYTES: "10" }, client }).chat(
      body(),
    ),
    { status: 400 },
  );
  assert.equal(client.inputs.length, 0);
});
test("per-minute call and estimated token allowances include tool follow-up calls", async () => {
  for (const limits of [
    { AXIOM_MAX_API_CALLS_PER_MINUTE: "1" },
    { AXIOM_MAX_TOKENS_PER_MINUTE: "1" },
  ]) {
    const client = mock(tool("list_tasks", { outstandingOnly: true }));
    await assert.rejects(
      createApp({ env: { ...env, ...limits }, client }).chat(body()),
      { status: 429 },
    );
    assert.ok(client.inputs.length <= 1);
  }
});
test("minute allowances reset while the process call budget remains in force", async () => {
  let time = 0;
  const client = mock(response("First"), response("Second"));
  const app = createApp({
    env: { ...env, AXIOM_MAX_API_CALLS_PER_MINUTE: "1" },
    client,
    now: () => time,
  });
  await app.chat(body());
  await assert.rejects(app.chat(body()), { status: 429 });
  time = 60001;
  await app.chat(body());
  assert.equal(client.inputs.length, 2);
});
test("Groq 429 honors bounded Retry-After cooldown and never leaks the provider error", async () => {
  let time = 0;
  const failure = new OpenAI.APIError(
    429,
    { message: "sensitive upstream contents" },
    "sensitive",
    new Headers({ "retry-after": "2" }),
  );
  const client = mock(failure, response("Recovered"));
  const app = createApp({ env, client, now: () => time });
  await assert.rejects(
    app.chat(body()),
    (e) =>
      e.status === 429 &&
      e.retryAfter === 2 &&
      !e.message.includes("sensitive"),
  );
  await assert.rejects(
    app.chat(body()),
    (e) => e.status === 429 && e.retryAfter === 2,
  );
  assert.equal(client.inputs.length, 1);
  time = 2001;
  assert.equal((await app.chat(body())).content, "Recovered");
});
test("network failures and unavailable models produce clear redacted messages", async () => {
  await assert.rejects(
    createApp({ env, client: mock(new Error("private network details")) }).chat(
      body(),
    ),
    (e) =>
      e.status === 502 &&
      e.message.includes("Groq is unavailable") &&
      !e.message.includes("private"),
  );
  await assert.rejects(
    createApp({
      env,
      client: mock(
        new OpenAI.APIError(404, {}, "private model response", new Headers()),
      ),
    }).chat(body()),
    (e) =>
      e.status === 502 &&
      e.message.includes("GROQ_MODEL") &&
      !e.message.includes("private"),
  );
});
