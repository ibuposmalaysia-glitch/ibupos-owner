const { cors, json } = require("../lib/auth");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Set-Cookie", "ibu_owner=; Path=/; HttpOnly; Max-Age=0");
  json(res, 200, { ok: true });
};
