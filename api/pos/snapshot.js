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
  outlet.snapshot = {
    ...body,
    generatedAt: body.generatedAt || new Date().toISOString()
  };
  const day = String(body.businessDate || new Date().toISOString().slice(0, 10));
  outlet.daily[day] = {
    netSales: body.netSales || 0,
    tickets: body.tickets || 0,
    avgTicket: body.avgTicket || 0,
    refunds: body.refunds || 0,
    paymentMix: body.paymentMix || [],
    topItems: body.topItems || [],
    generatedAt: outlet.snapshot.generatedAt
  };
  await store.save(state);
  json(res, 200, { ok: true });
};
