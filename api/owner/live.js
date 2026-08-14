const { cors, json, requireOwner } = require("../../lib/auth");
const store = require("../../lib/store");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (!requireOwner(req, res)) return;
  const state = await store.load();
  const outlets = Object.values(state.outlets || {}).map((o) => ({
    id: o.id,
    name: o.name,
    snapshot: o.snapshot
  }));
  json(res, 200, { outlets });
};
