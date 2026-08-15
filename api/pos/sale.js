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
  if (!outlet.snapshot) outlet.snapshot = {};
  const add = Number(body.amount || 0);
  const addTickets = Math.max(1, Number(body.tickets || 1));
  const net = Number(outlet.snapshot.netSales || 0) + add;
  const tickets = Number(outlet.snapshot.tickets || 0) + addTickets;
  const eodNet = Number(outlet.snapshot.eodNetSales != null ? outlet.snapshot.eodNetSales : outlet.snapshot.netSales || 0) + add;
  const eodTickets = Number(outlet.snapshot.eodTickets != null ? outlet.snapshot.eodTickets : outlet.snapshot.tickets || 0) + addTickets;
  outlet.snapshot.netSales = net;
  outlet.snapshot.tickets = tickets;
  outlet.snapshot.avgTicket = tickets > 0 ? Math.round((net / tickets) * 100) / 100 : 0;
  outlet.snapshot.eodNetSales = eodNet;
  outlet.snapshot.eodTickets = eodTickets;
  outlet.snapshot.eodAvgTicket = eodTickets > 0 ? Math.round((eodNet / eodTickets) * 100) / 100 : 0;
  outlet.snapshot.generatedAt = body.paidAt || new Date().toISOString();
  await store.save(state, token);
  json(res, 200, { ok: true });
};
