/** Comprueba deduplicación, caducidad y aislamiento del perfil sin contactar a Supabase. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/lib/authUser.js", import.meta.url), "utf8")
  .replace('import { supabase } from "./supabase";', "")
  .replaceAll("export ", "");

function setup() {
  let clock = 0;
  let requests = 0;
  let session = { access_token: "first", user: { id: "first" } };
  let resolveProfile;
  let blocked = false;
  const client = {
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: session?.user } }),
    },
    from: () => ({ select: () => ({ eq: (field, userId) => ({ maybeSingle: async () => {
      requests += 1;
      if (blocked) await new Promise((resolve) => { resolveProfile = resolve; });
      return { data: { auth_user_id: userId, rol: "admin", activo: true } };
    } }) }) }),
  };
  const api = new Function("supabase", "Date", `${source}; return { getAuthorizedUser, clearAuthorizedUserCache, getCachedAuthorizedUser };`)(client, { now: () => clock });
  return { api, count: () => requests, advance: () => { clock += 30_001; }, change: () => { session = { access_token: "second", user: { id: "second" } }; }, block: () => { blocked = true; }, release: () => resolveProfile() };
}

test("shares simultaneous requests and reuses a fresh profile", async () => {
  const state = setup();
  await Promise.all([state.api.getAuthorizedUser(), state.api.getAuthorizedUser()]);
  await state.api.getAuthorizedUser();
  assert.equal(state.count(), 1);
});

test("refreshes expired profiles", async () => {
  const state = setup();
  await state.api.getAuthorizedUser();
  state.advance();
  assert.equal(state.api.getCachedAuthorizedUser(), null);
  await state.api.getAuthorizedUser();
  assert.equal(state.count(), 2);
});

test("does not reuse permissions between accounts", async () => {
  const state = setup();
  await state.api.getAuthorizedUser();
  state.change();
  assert.equal((await state.api.getAuthorizedUser()).auth_user_id, "second");
  assert.equal(state.count(), 2);
});

test("an old request cannot restore a cleared profile", async () => {
  const state = setup();
  state.block();
  const request = state.api.getAuthorizedUser();
  await new Promise((resolve) => setImmediate(resolve));
  state.api.clearAuthorizedUserCache();
  state.release();
  assert.equal(await request, null);
  assert.equal(state.api.getCachedAuthorizedUser(), null);
});
