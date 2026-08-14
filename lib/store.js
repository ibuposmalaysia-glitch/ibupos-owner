const KEY = "ibupos-owner-v1";
const REPO = process.env.GITHUB_REPO || "ibuposmalaysia-glitch/ibupos-owner";
const BRANCH = process.env.OWNER_DATA_BRANCH || "owner-data";
const CACHE_MS = 1500;
const SAVE_STICKY_MS = 120000;

function emptyOutlet(id, name) {
  return {
    id,
    name: name || id,
    snapshot: null,
    daily: {},
    eods: {},
    deleted: [],
    drawer: []
  };
}

function emptyState() {
  return { outlets: {} };
}

let memCache = { at: 0, data: null, fromSave: false };

function parseStore(body) {
  if (!body || typeof body !== "object") return null;
  if (body.outlets) return body;
  if (body.content && body.encoding === "base64") {
    try {
      const parsed = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
      return parsed && parsed.outlets ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function generatedAt(state) {
  const outlets = state && state.outlets ? Object.values(state.outlets) : [];
  let latest = 0;
  outlets.forEach((o) => {
    const t = Date.parse((o.snapshot && o.snapshot.generatedAt) || "") || 0;
    if (t > latest) latest = t;
  });
  return latest;
}

async function githubGet() {
  const headers = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "ibupos-owner",
    "Cache-Control": "no-cache"
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = "Bearer " + process.env.GITHUB_TOKEN;
  }
  try {
    const res = await fetch(
      "https://api.github.com/repos/" +
        REPO +
        "/contents/data/store.json?ref=" +
        BRANCH +
        "&t=" +
        Date.now(),
      { headers, cache: "no-store" }
    );
    if (res.ok) {
      const body = await res.json();
      const parsed = parseStore(body);
      if (parsed) return parsed;
    }
  } catch {
    /* raw fallback */
  }

  const rawUrl =
    "https://raw.githubusercontent.com/" +
    REPO +
    "/" +
    BRANCH +
    "/data/store.json?t=" +
    Date.now();
  const raw = await fetch(rawUrl, {
    headers: { "User-Agent": "ibupos-owner", Accept: "application/json", "Cache-Control": "no-cache" },
    cache: "no-store"
  });
  if (!raw.ok) return null;
  const body = await raw.json();
  return parseStore(body);
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

function memSet(state, fromSave) {
  globalThis.__ibuposOwner = state;
  memCache = { at: Date.now(), data: state, fromSave: !!fromSave };
}

async function load() {
  const sticky = memCache.fromSave ? SAVE_STICKY_MS : CACHE_MS;
  if (memCache.data && Date.now() - memCache.at < sticky) {
    return memCache.data;
  }
  const fromGh = await githubGet();
  if (fromGh) {
    if (
      memCache.fromSave &&
      memCache.data &&
      Date.now() - memCache.at < SAVE_STICKY_MS &&
      generatedAt(memCache.data) >= generatedAt(fromGh)
    ) {
      return memCache.data;
    }
    memSet(fromGh, false);
    return fromGh;
  }
  const fromKv = await kvGet();
  if (fromKv && fromKv.outlets) {
    memSet(fromKv, false);
    return fromKv;
  }
  return memGet();
}

async function save(state) {
  memSet(state, true);
  await kvSet(state);
}

function ensureOutlet(state, outletId, outletName) {
  const id = String(outletId || process.env.OUTLET_ID || "ibu-main");
  if (!state.outlets) state.outlets = {};
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
