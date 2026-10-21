import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/services/api.js", import.meta.url), "utf8");
const chatSource = source.slice(source.indexOf("export const aiApi ="), source.indexOf("export default api;"))
  .replace("export const aiApi =", "return")
  .replaceAll("import.meta.env.VITE_API_KEY", '"test-key"');
const createApi = new Function("supabase", "fetch", "baseURL", chatSource);
const signedIn = { auth: { getSession: async () => ({ data: { session: { access_token: "test-token" } } }) } };

function responseFor(text) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  }));
}

test("sends authentication and decodes fragmented UTF-8 and SSE", async () => {
  const api = createApi(signedIn, async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(JSON.parse(options.body).session_id, "session");
    return responseFor('data: {"type":"delta","text":"Sí"}\r\n\r\ndata: {"type":"done"}\r\n\r\n');
  }, "/api");
  const updates = [];
  const result = await api.chatStream("Hola", { sessionId: "session", onDelta: (delta) => updates.push(delta) });
  assert.equal(result.response, "Sí");
  assert.deepEqual(updates, ["Sí"]);
});

test("rejects missing sessions before calling backend", async () => {
  const signedOut = { auth: { getSession: async () => ({ data: { session: null } }) } };
  const api = createApi(signedOut, () => assert.fail("unexpected fetch"), "/api");
  await assert.rejects(api.chatStream("Hola"), /sesión expiró/);
});

test("reports truncated streams and keeps delivered text", async () => {
  const api = createApi(signedIn, async () => responseFor('data: {"type":"delta","text":"Parcial"}\n\n'), "/api");
  let received = "";
  await assert.rejects(api.chatStream("Hola", { onDelta: (delta, fullText) => { received = fullText; } }), /interrumpió/);
  assert.equal(received, "Parcial");
});

test("reports backend stream errors", async () => {
  const api = createApi(signedIn, async () => responseFor('data: {"type":"error","detail":"No disponible"}\n\n'), "/api");
  await assert.rejects(api.chatStream("Hola"), /No disponible/);
});

test("delivers proposals without executing them", async () => {
  const action = { id: "proposal", operation: "crear_persona", payload: { nombre: "Prueba" } };
  const api = createApi(signedIn, async () => responseFor(`data: ${JSON.stringify({ type: "action", action })}\n\ndata: {"type":"done"}\n\n`), "/api");
  const received = [];
  await api.chatStream("Preparar alta", { onAction: (value) => received.push(value) });
  assert.deepEqual(received, [action]);
});

test("reports malformed events", async () => {
  const api = createApi(signedIn, async () => responseFor('data: invalid\n\n'), "/api");
  await assert.rejects(api.chatStream("Hola"), /respuesta inválida/);
});
