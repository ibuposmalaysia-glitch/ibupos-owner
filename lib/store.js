const KEY = "ibupos-owner-v1";
const REPO = process.env.GITHUB_REPO || "ibuposmalaysia-glitch/ibupos-owner";
const BRANCH = process.env.OWNER_DATA_BRANCH || "owner-data";
const CACHE_MS = 800;
const SAVE_STICKY_MS = 15000;
const CONTENTS =
  "https://api.github.com/repos/" + REPO + "/contents/data/store.json?ref=" + BRANCH;

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

function rememberToken(token) {
  const t = String(token || "").trim();
  if (t) globalThis.__ibuposGhToken = t;
}

function ghToken(explicit) {
  return String(explicit || process.env.GITHUB_TOKEN || globalThis.__ibuposGhToken || "").trim();
}

function ghHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ibupos-owner",
    "X-GitHub-Api-Version": "2022-11-28",
    "Cache-Control": "no-cache"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

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

async function githubGetMeta(token) {
  const res = await fetch(CONTENTS + "&t=" + Date.now(), {
    headers: ghHeaders(token),
    cache: "no-store"
  });
  if (!res.ok) return { ok: false, status: res.status };
  const body = await res.json();
  return { ok: true, sha: body.sha, data: parseStore(body), status: res.status };
}

async function githubGet(token) {
  try {
    const meta = await githubGetMeta(token);
    if (meta.ok && meta.data) return meta.data;
  } catch {
    /* raw fallback */
  }
  if (token) return null;
  const rawUrl =
    "https://raw.githubusercontent.com/" +
    REPO +
    "/" +
    BRANCH +
    "/data/store.json?t=" +
    Date.now();
  try {
    const raw = await fetch(rawUrl, {
      headers: { "User-Agent": "ibupos-owner", Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store"
    });
    if (!raw.ok) return null;
    return parseStore(await raw.json());
  } catch {
    return null;
  }
}

async function githubPut(state, token) {
  if (!token) return false;
  let sha;
  try {
    const meta = await githubGetMeta(token);
    if (meta.ok) sha = meta.sha;
    else if (meta.status && meta.status !== 404) return false;
  } catch {
    return false;
  }
  const content = Buffer.from(JSON.stringify(state)).toString("base64");
  for (let i = 0; i < 2; i++) {
    const res = await fetch("https://api.github.com/repos/" + REPO + "/contents/data/store.json", {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders(token)),
      body: JSON.stringify({
        message: "sync owner sales",
        content,
        branch: BRANCH,
        sha
      })
    });
    if (res.ok) return true;
    if (res.status !== 409 && res.status !== 422) return false;
    const again = await githubGetMeta(token);
    sha = again.sha;
  }
  return false;
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

async function load(explicitToken) {
  const token = ghToken(explicitToken);
  const sticky = memCache.fromSave ? SAVE_STICKY_MS : CACHE_MS;
  if (memCache.data && Date.now() - memCache.at < sticky) {
    return memCache.data;
  }
  const fromGh = await githubGet(token);
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
  if (memCache.data) return memCache.data;
  return memGet();
}

async function save(state, explicitToken) {
  const token = ghToken(explicitToken);
  rememberToken(token);
  memSet(state, true);
  await Promise.all([kvSet(state), githubPut(state, token)]);
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
  emptyOutlet,
  rememberToken,
  ghToken
};
