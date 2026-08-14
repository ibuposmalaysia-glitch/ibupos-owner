const { cors, json, validSession } = require("../lib/auth");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  json(res, 200, { signedIn: validSession(req) });
};
