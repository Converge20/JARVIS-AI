import { createServer } from "./app.mjs";
const port = Number(process.env.API_PORT || 3001);
createServer().listen(port, "127.0.0.1", () =>
  console.log(
    `AXIOM server listening on http://127.0.0.1:${port}. Groq text requests require GROQ_API_KEY and GROQ_ENABLED=true.`,
  ),
);
