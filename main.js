// IQvori – © 2026 Fabian Emmer
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

let autoUpdater = null;
try { autoUpdater = require("electron-updater").autoUpdater; } catch (e) { autoUpdater = null; }

const API = "https://api.anthropic.com/v1/messages";
const MODELS = {
  "claude-sonnet-5-5": "Sonnet 5.5 (empfohlen)",
  "claude-opus-5-5": "Opus 5.5 (beste Qualität, teurer)",
  "claude-haiku-5-5": "Haiku 5.5 (schnell und günstig)"
};

let win = null;
const pending = new Map();

const userDir = () => app.getPath("userData");
const libDir = () => path.join(userDir(), "library");
const settingsFile = () => path.join(userDir(), "settings.json");

/* ---------- Einstellungen ---------- */
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), "utf8")); } catch (e) { return {}; }
}
function writeSettings(s) {
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}
function getKey() {
  const s = readSettings();
  try {
    if (s.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(s.keyEnc, "base64"));
  } catch (e) {}
  return s.keyPlain || "";
}
function setKey(key) {
  const s = readSettings();
  delete s.keyEnc; delete s.keyPlain;
  if (key) {
    if (safeStorage.isEncryptionAvailable()) s.keyEnc = safeStorage.encryptString(key).toString("base64");
    else s.keyPlain = key;
  }
  writeSettings(s);
}
function publicSettings() {
  const s = readSettings();
  const key = getKey();
  return {
    hasKey: !!key,
    keyHint: key ? "…" + key.slice(-4) : "",
    model: MODELS[s.model] ? s.model : "claude-sonnet-5-5",
    models: MODELS,
    theme: s.theme || "system",
    version: app.getVersion(),
    packaged: app.isPackaged,
    dataDir: libDir()
  };
}

/* ---------- Fenster ---------- */
function createWindow() {
  const theme = readSettings().theme || "system";
  nativeTheme.themeSource = theme;
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 560,
    title: "IQvori",
    icon: path.join(__dirname, "app", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0A0A0A" : "#F6F6F4",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "app", "index.html"));
  win.once("ready-to-show", () => {
    win.show();
    if (app.isPackaged && autoUpdater) {
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 15 * 60 * 1000);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file://")) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
}

const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId("at.fabianemmer.iqvori");
    createWindow();
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}

/* ---------- Bibliothek (lokal) ---------- */
async function atomicWrite(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}
const safeId = id => String(id).replace(/[^a-zA-Z0-9_-]/g, "");

ipcMain.handle("store-load", async () => {
  await fsp.mkdir(libDir(), { recursive: true });
  const files = await fsp.readdir(libDir());
  const materials = []; let stats = null;
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const v = JSON.parse(await fsp.readFile(path.join(libDir(), f), "utf8"));
      if (f === "stats.json") stats = v; else if (v && v.kind === "mat") materials.push(v);
    } catch (e) {}
  }
  materials.sort((a, b) => b.createdAt - a.createdAt);
  return { materials, stats };
});
ipcMain.handle("store-save-mat", (e, m) => atomicWrite(path.join(libDir(), "m_" + safeId(m.id) + ".json"), JSON.stringify(m)));
ipcMain.handle("store-del-mat", async (e, id) => { try { await fsp.unlink(path.join(libDir(), "m_" + safeId(id) + ".json")); } catch (err) {} });
ipcMain.handle("store-save-stats", (e, s) => atomicWrite(path.join(libDir(), "stats.json"), JSON.stringify(s)));

ipcMain.handle("export", async () => {
  const r = await dialog.showSaveDialog(win, { title: "Bibliothek sichern", defaultPath: `IQvori-Sicherung-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: "IQvori-Sicherung", extensions: ["json"] }] });
  if (r.canceled || !r.filePath) return { ok: false };
  const files = await fsp.readdir(libDir()).catch(() => []);
  const out = { app: "IQvori", version: app.getVersion(), date: Date.now(), materials: [], stats: null };
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try { const v = JSON.parse(await fsp.readFile(path.join(libDir(), f), "utf8")); if (f === "stats.json") out.stats = v; else if (v.kind === "mat") out.materials.push(v); } catch (e) {}
  }
  await fsp.writeFile(r.filePath, JSON.stringify(out));
  return { ok: true, count: out.materials.length };
});
ipcMain.handle("import", async () => {
  const r = await dialog.showOpenDialog(win, { title: "Sicherung laden", properties: ["openFile"], filters: [{ name: "IQvori-Sicherung", extensions: ["json"] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  try {
    const data = JSON.parse(await fsp.readFile(r.filePaths[0], "utf8"));
    if (data.app !== "IQvori" || !Array.isArray(data.materials)) return { ok: false, error: "Das ist keine IQvori-Sicherung." };
    for (const m of data.materials) if (m && m.kind === "mat" && m.id) await atomicWrite(path.join(libDir(), "m_" + safeId(m.id) + ".json"), JSON.stringify(m));
    return { ok: true, count: data.materials.length };
  } catch (e) { return { ok: false, error: "Die Datei konnte nicht gelesen werden." }; }
});

/* ---------- Dateien ---------- */
ipcMain.handle("save-file", async (e, { name, data }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: String(name || "IQvori.txt").replace(/[\\/:*?"<>|]/g, ""), filters: [{ name: "Textdatei", extensions: ["txt"] }] });
  if (r.canceled || !r.filePath) return false;
  await fsp.writeFile(r.filePath, String(data));
  return true;
});
ipcMain.handle("open-external", (e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle("open-data", () => shell.openPath(libDir()));

/* ---------- Einstellungen IPC ---------- */
ipcMain.handle("settings-get", () => publicSettings());
ipcMain.handle("settings-set", (e, p) => {
  if (typeof p.key === "string") setKey(p.key.trim());
  const s = readSettings();
  if (p.model && MODELS[p.model]) s.model = p.model;
  if (p.theme && ["system", "light", "dark"].includes(p.theme)) { s.theme = p.theme; nativeTheme.themeSource = p.theme; }
  writeSettings(s);
  return publicSettings();
});

/* ---------- KI (Anthropic API) ---------- */
function errCode(status, msg) {
  msg = String(msg || "");
  if (status === 401 || status === 403) return "bad_key";
  if (status === 429) return "rate_limited";
  if (/credit balance/i.test(msg)) return "no_credit";
  if (status === 413 || /too long|too large|exceeds/i.test(msg)) return "prompt_too_large";
  if (status === 529 || status >= 500) return "overloaded";
  return "upstream_error";
}
async function callClaude(req, signal) {
  const key = getKey();
  if (!key) return { error: "no_key" };
  const s = readSettings();
  const messages = (req.messages || []).map(m => ({ role: m.role, content: String(m.content) }));
  if (req.images && req.images.length && messages.length) {
    const last = messages[messages.length - 1];
    last.content = [...req.images.map(i => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })), { type: "text", text: last.content }];
  }
  const body = { model: req.model || (MODELS[s.model] ? s.model : "claude-sonnet-5-5"), max_tokens: req.maxTokens || 12000, messages };
  if (req.json) body.system = "Antworte ausschließlich mit gültigem JSON. Kein Text davor oder danach, kein Codeblock.";
  const res = await fetch(API, {
    method: "POST", signal,
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: errCode(res.status, data && data.error && data.error.message), message: data && data.error && data.error.message };
  const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  if (!text.trim()) return { error: "empty_completion" };
  return { text, truncated: data.stop_reason === "max_tokens" };
}
ipcMain.handle("ai", async (e, req) => {
  const ctl = new AbortController();
  pending.set(req.id, ctl);
  try { return await callClaude(req, ctl.signal); }
  catch (err) { return { error: ctl.signal.aborted ? "cancelled" : "offline", message: String(err) }; }
  finally { pending.delete(req.id); }
});
ipcMain.on("ai-cancel", (e, id) => { const c = pending.get(id); if (c) c.abort(); });
ipcMain.handle("ai-test", async () => {
  try { const r = await callClaude({ messages: [{ role: "user", content: "Antworte nur mit: OK" }], maxTokens: 10, model: "claude-haiku-5-5" }); return r.error ? r : { ok: true }; }
  catch (err) { return { error: "offline" }; }
});

/* ---------- Updates ---------- */
const sendUpdate = d => { if (win && !win.isDestroyed()) win.webContents.send("update", d); };
if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdate({ state: "checking" }));
  autoUpdater.on("update-available", i => sendUpdate({ state: "downloading", version: i.version }));
  autoUpdater.on("update-not-available", () => sendUpdate({ state: "none" }));
  autoUpdater.on("download-progress", p => sendUpdate({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", i => sendUpdate({ state: "ready", version: i.version }));
  autoUpdater.on("error", err => sendUpdate({ state: "error", message: String(err && err.message || err) }));
}
ipcMain.handle("update-check", async () => {
  if (!app.isPackaged || !autoUpdater) return { state: "dev" };
  try { await autoUpdater.checkForUpdates(); return { state: "checking" }; } catch (e) { return { state: "error" }; }
});
ipcMain.handle("update-install", () => { if (autoUpdater) autoUpdater.quitAndInstall(false, true); });
