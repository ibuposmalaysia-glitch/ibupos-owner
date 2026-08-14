const { cors, json, requireOwner } = require("../../lib/auth");
const store = require("../../lib/store");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireOwner(req, res)) return;
  const url = new URL(req.url, "http://local");
  const outletId = url.searchParams.get("outletId") || process.env.OUTLET_ID || "ibu-main";
  const state = await store.load();
  const outlet = (state.outlets || {})[outletId];
  json(res, 200, { items: outlet ? outlet.deleted || [] : [] });
};
