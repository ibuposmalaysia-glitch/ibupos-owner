const app = document.getElementById("app");
let tab = "live";
let outlets = [];
let outletId = "";
let historyDays = [];
let deleted = [];
let drawer = [];
let range = "week";

function money(n) {
  const v = Number(n || 0);
  return "RM " + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function api(path, opts) {
  const res = await fetch(path, Object.assign({ credentials: "same-origin" }, opts || {}));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function header(title, sub) {
  return `<div class="header"><div class="topbar"><div>
    <div class="wordmark"><span>i</span>bu</div>
    <h1>${title}</h1>
    <div class="sub">${sub || ""}</div>
  </div><button class="btn" id="logout">Sign out</button></div></div>`;
}

function nav() {
  const items = [
    ["live", "Live sales"],
    ["history", "Previous"],
    ["deleted", "Deleted"],
    ["drawer", "Drawer"]
  ];
  return `<div class="nav">${items.map(([id, label]) =>
    `<button data-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`
  ).join("")}</div>`;
}

function outletPicker() {
  if (outlets.length < 2) return "";
  return `<select id="outlet">${outlets.map(o =>
    `<option value="${o.id}" ${o.id === outletId ? "selected" : ""}>${o.name || o.id}</option>`
  ).join("")}</select>`;
}

function currentOutlet() {
  return outlets.find(o => o.id === outletId) || outlets[0] || { snapshot: null };
}

function renderLogin(err) {
  app.innerHTML = `
    <div class="header"><div class="wordmark"><span>i</span>bu</div><h1>Owner reports</h1>
    <div class="sub">Enter the owner PIN</div></div>
    <div class="wrap"><div class="card">
      <input class="pin" id="pin" type="password" inputmode="numeric" maxlength="8" placeholder="PIN" />
      ${err ? `<div class="err">${err}</div>` : ""}
      <button class="btn btn-primary" id="go">Open reports</button>
    </div></div>`;
  document.getElementById("go").onclick = signIn;
  document.getElementById("pin").onkeydown = (e) => { if (e.key === "Enter") signIn(); };
}

async function signIn() {
  const pin = document.getElementById("pin").value.trim();
  try {
    await api("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    await loadAll();
  } catch (e) {
    renderLogin(e.message);
  }
}

function mixRows(mix) {
  if (!mix || !mix.length) return `<div class="muted">No payment mix yet.</div>`;
  return mix.map(p => `<div class="row"><span>${p.name}</span><b>${money(p.amount)}</b></div>`).join("");
}

function renderLive() {
  const snap = currentOutlet().snapshot;
  app.innerHTML = header("Live sales", "Today at this outlet") + `<div class="wrap">
    ${outletPicker()}${nav()}
    ${!snap ? `<div class="card empty">Waiting for POS to send today's sales. Keep the cashier PC online.</div>` : `
      <div class="kpis">
        <div class="kpi"><span>Net sales</span><b>${money(snap.netSales)}</b></div>
        <div class="kpi"><span>Bills</span><b>${snap.tickets || 0}</b></div>
        <div class="kpi"><span>Avg ticket</span><b>${money(snap.avgTicket)}</b></div>
        <div class="kpi"><span>Refunds</span><b>${money(snap.refunds)}</b></div>
      </div>
      <div class="card" style="margin-top:12px"><b>Payment mix</b>${mixRows(snap.paymentMix)}</div>
      <div class="card"><b>Top items</b>${
        (snap.topItems || []).length
          ? snap.topItems.map(i => `<div class="row"><span>${i.name}</span><b>${i.qty || 0}</b></div>`).join("")
          : `<div class="muted">No items yet.</div>`
      }</div>
      <div class="muted">Updated ${snap.generatedAt ? new Date(snap.generatedAt).toLocaleString() : ""}</div>
    `}
  </div>`;
  bindChrome();
}

function dateRange() {
  const to = new Date();
  const from = new Date();
  if (range === "yesterday") { from.setDate(to.getDate() - 1); to.setDate(to.getDate() - 1); }
  else if (range === "week") from.setDate(to.getDate() - 6);
  else if (range === "month") from.setDate(to.getDate() - 29);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function renderHistory() {
  const total = historyDays.reduce((s, d) => s + Number(d.netSales || 0), 0);
  app.innerHTML = header("Previous sales", "Pick a date range") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="chips">
      <button data-range="yesterday" class="${range === "yesterday" ? "active" : ""}">Yesterday</button>
      <button data-range="week" class="${range === "week" ? "active" : ""}">7 days</button>
      <button data-range="month" class="${range === "month" ? "active" : ""}">30 days</button>
    </div>
    <div class="kpi"><span>Range total</span><b>${money(total)}</b></div>
    <div class="card" style="margin-top:12px">
      ${historyDays.length ? historyDays.map(d => `<div class="row"><span>${d.date}</span><b>${money(d.netSales)}</b></div>`).join("") : `<div class="empty">No previous days stored yet. Totals are saved at shift close / as POS syncs.</div>`}
    </div>
  </div>`;
  bindChrome();
  document.querySelectorAll("[data-range]").forEach(b => b.onclick = async () => {
    range = b.getAttribute("data-range");
    await loadHistory();
    renderHistory();
  });
}

function renderDeleted() {
  app.innerHTML = header("Deleted history", "Item, date, user") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="card">
      ${deleted.length ? deleted.map(r => `<div class="row"><div><b>${r.itemName}</b><div class="muted">${r.deletedBy} · ${new Date(r.deletedAt).toLocaleString()}</div></div><b>${r.qty || ""}</b></div>`).join("") : `<div class="empty">No deleted items yet.</div>`}
    </div>
  </div>`;
  bindChrome();
}

function renderDrawer() {
  app.innerHTML = header("Manual drawer", "Opens that were not payment") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="card">
      ${drawer.length ? drawer.map(r => `<div class="row"><div><b>${r.userName}</b><div class="muted">${new Date(r.openedAt).toLocaleString()}</div></div></div>`).join("") : `<div class="empty">No manual drawer opens yet.</div>`}
    </div>
  </div>`;
  bindChrome();
}

function bindChrome() {
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.getAttribute("data-tab"); paint(); });
  const out = document.getElementById("outlet");
  if (out) out.onchange = async () => { outletId = out.value; await loadLists(); paint(); };
  const lo = document.getElementById("logout");
  if (lo) lo.onclick = async () => { await api("/api/logout", { method: "POST" }); renderLogin(); };
}

function paint() {
  if (tab === "history") renderHistory();
  else if (tab === "deleted") renderDeleted();
  else if (tab === "drawer") renderDrawer();
  else renderLive();
}

async function loadHistory() {
  const { from, to } = dateRange();
  const data = await api(`/api/owner/history?outletId=${encodeURIComponent(outletId)}&from=${from}&to=${to}`);
  historyDays = data.days || [];
}

async function loadLists() {
  if (!outletId) return;
  const [d, w] = await Promise.all([
    api(`/api/owner/deleted?outletId=${encodeURIComponent(outletId)}`),
    api(`/api/owner/drawer?outletId=${encodeURIComponent(outletId)}`)
  ]);
  deleted = d.items || [];
  drawer = w.items || [];
  await loadHistory();
}

async function loadAll() {
  const live = await api("/api/owner/live");
  outlets = live.outlets || [];
  if (!outletId) outletId = outlets[0] ? outlets[0].id : "ibu-main";
  await loadLists();
  paint();
}

async function boot() {
  try {
    const s = await api("/api/session");
    if (s.signedIn) await loadAll();
    else renderLogin();
  } catch {
    renderLogin();
  }
}

boot();
setInterval(() => { if (tab === "live" && outletId) loadAll().catch(() => {}); }, 12000);
