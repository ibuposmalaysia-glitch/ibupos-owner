const app = document.getElementById("app");
let tab = "live";
let outlets = [];
let outletId = "";
let historyEods = [];
let deleted = [];
let drawer = [];
let range = "week";
let openEod = "";

function money(n) {
  const v = Number(n || 0);
  return "RM " + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return "";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

function kpis(net, tickets, avg, refunds) {
  return `<div class="kpis">
    <div class="kpi"><span>Net sales</span><b>${money(net)}</b></div>
    <div class="kpi"><span>Bills</span><b>${tickets || 0}</b></div>
    <div class="kpi"><span>Avg ticket</span><b>${money(avg)}</b></div>
    <div class="kpi"><span>Refunds</span><b>${money(refunds)}</b></div>
  </div>`;
}

function renderLive() {
  const snap = currentOutlet().snapshot;
  const shift = snap && (snap.shiftName || "Shift");
  const eod = snap && (snap.eodDate || snap.businessDate);
  const sub = snap
    ? `EOD ${fmtDate(eod)} · ${shift}${snap.shiftOpen === false ? "" : " · open"}`
    : "Current EOD and shift";
  app.innerHTML = header("Live sales", sub) + `<div class="wrap">
    ${outletPicker()}${nav()}
    ${!snap ? `<div class="card empty">Waiting for POS to send this shift. Keep the cashier PC online.</div>` : `
      <div class="section-title">This shift · ${shift}${snap.employeeName ? " / " + snap.employeeName : ""}</div>
      ${kpis(snap.netSales, snap.tickets, snap.avgTicket, snap.refunds)}
      <div class="section-title">This EOD so far</div>
      ${kpis(snap.eodNetSales != null ? snap.eodNetSales : snap.netSales, snap.eodTickets != null ? snap.eodTickets : snap.tickets, snap.eodAvgTicket != null ? snap.eodAvgTicket : snap.avgTicket, snap.eodRefunds != null ? snap.eodRefunds : snap.refunds)}
      <div class="card" style="margin-top:12px"><b>Payment mix · ${shift}</b>${mixRows(snap.paymentMix)}</div>
      <div class="card"><b>Top items · ${shift}</b>${
        (snap.topItems || []).length
          ? snap.topItems.map(i => `<div class="row"><span>${i.name}</span><b>${i.qty || 0}</b></div>`).join("")
          : `<div class="muted">No items yet.</div>`
      }</div>
      <div class="muted">Updated ${snap.generatedAt ? new Date(snap.generatedAt).toLocaleString() : ""}</div>
    `}
  </div>`;
  bindChrome();
}

function renderHistory() {
  const total = historyEods.reduce((s, d) => s + Number(d.netSales || 0), 0);
  app.innerHTML = header("Previous sales", "By EOD date, then shift") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="chips">
      <button data-range="yesterday" class="${range === "yesterday" ? "active" : ""}">Last EOD</button>
      <button data-range="week" class="${range === "week" ? "active" : ""}">7 EODs</button>
      <button data-range="month" class="${range === "month" ? "active" : ""}">30 EODs</button>
    </div>
    <div class="kpi"><span>Range total</span><b>${money(total)}</b></div>
    <div class="card" style="margin-top:12px">
      ${historyEods.length ? historyEods.map(eod => {
        const id = eod.eodDate;
        const open = openEod === id;
        const shifts = eod.shifts || [];
        return `<div class="eod-block">
          <button class="eod-head" data-eod="${id}">
            <div>
              <b>EOD ${fmtDate(id)}</b>
              <div class="muted">${eod.closed ? "Closed" : "Open"} · ${shifts.length} shift${shifts.length === 1 ? "" : "s"}</div>
            </div>
            <b>${money(eod.netSales)}</b>
          </button>
          ${open && shifts.length ? shifts.map(s => `
            <div class="shift-row">
              <div>
                <b>${s.shiftName || "Shift"}</b>
                <div class="muted">${s.employeeName || ""}${s.open ? " · open" : ""} · ${s.tickets || 0} bills</div>
              </div>
              <b>${money(s.netSales)}</b>
            </div>`).join("") : ""}
        </div>`;
      }).join("") : `<div class="empty">No EOD totals yet. They appear as POS syncs each shift.</div>`}
    </div>
  </div>`;
  bindChrome();
  document.querySelectorAll("[data-range]").forEach(b => b.onclick = async () => {
    range = b.getAttribute("data-range");
    await loadHistory();
    renderHistory();
  });
  document.querySelectorAll("[data-eod]").forEach(b => b.onclick = () => {
    const id = b.getAttribute("data-eod");
    openEod = openEod === id ? "" : id;
    renderHistory();
  });
}

function metaLine(r) {
  const bits = [];
  if (r.eodDate) bits.push("EOD " + fmtDate(r.eodDate));
  if (r.shiftName) bits.push(r.shiftName);
  if (r.deletedBy || r.userName) bits.push(r.deletedBy || r.userName);
  const when = r.deletedAt || r.openedAt;
  if (when) bits.push(new Date(when).toLocaleString());
  return bits.join(" · ");
}

function renderDeleted() {
  app.innerHTML = header("Deleted history", "Item, EOD, shift, user") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="card">
      ${deleted.length ? deleted.map(r => `<div class="row"><div><b>${r.itemName}</b><div class="muted">${metaLine(r)}</div></div><b>${r.qty || ""}</b></div>`).join("") : `<div class="empty">No deleted items yet.</div>`}
    </div>
  </div>`;
  bindChrome();
}

function renderDrawer() {
  app.innerHTML = header("Manual drawer", "Opens that were not payment") + `<div class="wrap">
    ${outletPicker()}${nav()}
    <div class="card">
      ${drawer.length ? drawer.map(r => `<div class="row"><div><b>${r.userName}</b><div class="muted">${metaLine(r)}</div></div></div>`).join("") : `<div class="empty">No manual drawer opens yet.</div>`}
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

function historyRange(eods) {
  const dates = [...new Set((eods || []).map(e => e.eodDate).filter(Boolean))].sort();
  if (!dates.length) return { from: "0000-01-01", to: "9999-12-31" };
  const latest = dates[dates.length - 1];
  if (range === "yesterday") {
    const prev = dates.length > 1 ? dates[dates.length - 2] : latest;
    return { from: prev, to: prev };
  }
  const take = range === "month" ? 30 : 7;
  return { from: dates[Math.max(0, dates.length - take)], to: latest };
}

async function loadHistory() {
  const all = await api(`/api/owner/history?outletId=${encodeURIComponent(outletId)}`);
  const list = all.eods && all.eods.length ? all.eods : (all.days || []).map(d => ({ eodDate: d.date, ...d, shifts: [] }));
  const { from, to } = historyRange(list);
  historyEods = list.filter(e => e.eodDate >= from && e.eodDate <= to);
  if (!openEod && historyEods[0]) openEod = historyEods[0].eodDate;
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
