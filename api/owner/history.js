const { cors, json, requireOwner } = require("../../lib/auth");
const store = require("../../lib/store");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireOwner(req, res)) return;
  const url = new URL(req.url, "http://local");
  const outletId = url.searchParams.get("outletId") || process.env.OUTLET_ID || "ibu-main";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const state = await store.load();
  const outlet = (state.outlets || {})[outletId];
  if (!outlet) return json(res, 200, { days: [] });
  const days = Object.keys(outlet.daily || {})
    .sort()
    .reverse()
    .filter((d) => (!from || d >= from) && (!to || d <= to))
    .map((d) => ({ date: d, ...outlet.daily[d] }));
  json(res, 200, { outletId, days });
};
