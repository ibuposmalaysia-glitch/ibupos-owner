const { cors, json, readBody, requireDevice, outletId, githubToken } = require("../../lib/auth");
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
  const token = githubToken(req);
  const state = await store.load(token);
  const outlet = store.ensureOutlet(state, outletId(req, body), body.outletName);
  const row = {
    id: body.id || "",
    itemName: body.itemName || "Item",
    qty: body.qty || 0,
    amount: body.amount || 0,
    deletedAt: body.deletedAt || new Date().toISOString(),
    deletedBy: body.deletedBy || "Unknown",
    orderNo: body.orderNo || "",
    eodDate: body.eodDate || "",
    shiftName: body.shiftName || ""
  };
  outlet.deleted = [row].concat(outlet.deleted || []).slice(0, 500);
  await store.save(state, token);
  json(res, 200, { ok: true });
};
