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
  const eods = body.eods;
  const snap = { ...body };
  delete snap.eods;
  delete snap.deleted;
  delete snap.drawer;
  outlet.snapshot = {
    ...snap,
    generatedAt: body.generatedAt || new Date().toISOString()
  };
  if (Array.isArray(eods)) {
    if (!outlet.eods) outlet.eods = {};
    eods.forEach((eod) => {
      if (!eod || !eod.eodDate) return;
      outlet.eods[eod.eodDate] = eod;
    });
  } else if (eods && typeof eods === "object") {
    outlet.eods = Object.assign({}, outlet.eods || {}, eods);
  }
  const day = String(body.eodDate || body.businessDate || new Date().toISOString().slice(0, 10));
  if (!outlet.daily) outlet.daily = {};
  outlet.daily[day] = {
    netSales: body.eodNetSales || body.netSales || 0,
    tickets: body.eodTickets || body.tickets || 0,
    avgTicket: body.eodAvgTicket || body.avgTicket || 0,
    refunds: body.eodRefunds || body.refunds || 0,
    paymentMix: body.eodPaymentMix || body.paymentMix || [],
    topItems: body.eodTopItems || body.topItems || [],
    generatedAt: outlet.snapshot.generatedAt,
    eodDate: day,
    shiftName: body.shiftName || ""
  };
  await store.save(state, token);
  json(res, 200, { ok: true });
};
