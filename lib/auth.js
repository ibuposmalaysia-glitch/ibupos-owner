const crypto = require("crypto");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Device-Key,X-Outlet-Id"
  );
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

function readBody(req) {
  if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body))
    return Promise.resolve(req.body);
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function expectedPin() {
  return String(process.env.OWNER_PIN || "1234");
}

function expectedDeviceKey() {
  return String(process.env.POS_DEVICE_KEY || "ibu-device-key");
}

function signSession() {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp, role: "owner" })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "ibu-owner-session")
    .update(payload)
    .digest("base64url");
  return payload + "." + sig;
}

function validSession(req) {
  const cookie = String(req.headers.cookie || "");
  const match = cookie.match(/(?:^|;\s*)ibu_owner=([^;]+)/);
  if (!match) return false;
  const [payload, sig] = decodeURIComponent(match[1]).split(".");
  if (!payload || !sig) return false;
  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "ibu-owner-session")
    .update(payload)
    .digest("base64url");
  if (expected !== sig) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

function requireOwner(req, res) {
  if (validSession(req)) return true;
  json(res, 401, { error: "Please sign in." });
  return false;
}

function requireDevice(req, res) {
  const key = String(req.headers["x-device-key"] || "");
  if (key && key === expectedDeviceKey()) return true;
  json(res, 401, { error: "Invalid POS device key." });
  return false;
}

function outletId(req, body) {
  return String(
    (body && body.outletId) ||
      req.headers["x-outlet-id"] ||
      process.env.OUTLET_ID ||
      "ibu-main"
  );
}

module.exports = {
  json,
  cors,
  readBody,
  expectedPin,
  expectedDeviceKey,
  signSession,
  validSession,
  requireOwner,
  requireDevice,
  outletId
};
