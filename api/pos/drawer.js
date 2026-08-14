const { cors, json, readBody, requireDevice, outletId } = require("../../lib/auth");
const store = require("../../lib/store");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (!requireDevice(req, res)) return;
  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }
  const state = await store.load();
  const outlet = store.ensureOutlet(state, outletId(req, body), body.outletName);
  const row = {
    openedAt: body.openedAt || new Date().toISOString(),
    userName: body.userName || "Unknown",
    source: body.source || "Manual"
  };
  outlet.drawer = [row].concat(outlet.drawer || []).slice(0, 500);
  await store.save(state);
  json(res, 200, { ok: true });
};
