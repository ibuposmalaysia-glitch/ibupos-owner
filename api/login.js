const { cors, json, readBody, expectedPin, signSession } = require("../lib/auth");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { error: "Invalid JSON" });
  }
  const pin = String(body.pin || body.password || "");
  if (pin !== expectedPin()) return json(res, 401, { error: "Wrong PIN" });
  const token = signSession();
  res.setHeader(
    "Set-Cookie",
    "ibu_owner=" + token + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"
  );
  json(res, 200, { ok: true });
};
