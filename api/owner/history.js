const { cors, json, requireOwner } = require("../../lib/auth");
const store = require("../../lib/store");

function toList(eods) {
  if (!eods) return [];
  if (Array.isArray(eods)) return eods;
  return Object.keys(eods)
    .sort()
    .reverse()
    .map((k) => eods[k]);
}

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireOwner(req, res)) return;
  const url = new URL(req.url, "http://local");
  const outletId = url.searchParams.get("outletId") || process.env.OUTLET_ID || "ibu-main";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const state = await store.load();
  const outlet = (state.outlets || {})[outletId];
  if (!outlet) return json(res, 200, { eods: [], days: [] });
  let eods = toList(outlet.eods).filter((e) => e && e.eodDate);
  if (!eods.length && outlet.daily) {
    eods = Object.keys(outlet.daily)
      .sort()
      .reverse()
      .map((d) => ({ eodDate: d, closed: true, shifts: [], ...outlet.daily[d] }));
  }
  eods = eods.filter((e) => (!from || e.eodDate >= from) && (!to || e.eodDate <= to));
  const days = eods.map((e) => ({
    date: e.eodDate,
    netSales: e.netSales || 0,
    tickets: e.tickets || 0,
    avgTicket: e.avgTicket || 0,
    refunds: e.refunds || 0
  }));
  json(res, 200, { outletId, eods, days });
};
