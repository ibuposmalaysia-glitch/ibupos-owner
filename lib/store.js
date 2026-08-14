const KEY = "ibupos-owner-v1";

function emptyOutlet(id, name) {
  return {
    id,
    name: name || id,
    snapshot: null,
    daily: {},
    deleted: [],
    drawer: []
  };
}

function emptyState() {
  return { outlets: {} };
}

async function kvGet() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const res = await fetch(url.replace(/\/$/, "") + "/get/" + KEY, {
    headers: { Authorization: "Bearer " + token }
  });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body || body.result == null) return null;
  return typeof body.result === "string" ? JSON.parse(body.result) : body.result;
}

async function kvSet(state) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;
  const res = await fetch(url.replace(/\/$/, "") + "/set/" + KEY, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(state)
  });
  return res.ok;
}

function memGet() {
  if (!globalThis.__ibuposOwner) globalThis.__ibuposOwner = emptyState();
  return globalThis.__ibuposOwner;
}

function memSet(state) {
  globalThis.__ibuposOwner = state;
}

async function load() {
  const fromKv = await kvGet();
  if (fromKv && fromKv.outlets) {
    globalThis.__ibuposOwner = fromKv;
    return fromKv;
  }
  return memGet();
}

async function save(state) {
  memSet(state);
  await kvSet(state);
}

function ensureOutlet(state, outletId, outletName) {
  const id = String(outletId || process.env.OUTLET_ID || "ibu-main");
  if (!state.outlets[id]) state.outlets[id] = emptyOutlet(id, outletName);
  if (outletName) state.outlets[id].name = outletName;
  return state.outlets[id];
}

module.exports = {
  load,
  save,
  ensureOutlet,
  emptyOutlet
};
